# -*- coding: UTF-8 -*-
"""
__Author__ = "stephenXu"
__Description__ = "大麦余票监控 - 不下单，发现可购票档时响铃 + macOS 通知 + 终端高亮"
__Created__ = 2026-04-29

用法：
    1. 手机端：大麦 APP 打开目标场次，手动点底部"立即预订"让票档列表弹出
    2. 终端跑：
           cd damai_appium && poetry run python damai_monitor.py
       或带参数：
           poetry run python damai_monitor.py --interval 30 --max-rounds 100

参数：
    --interval N      每次轮询间隔秒数，默认 30
    --max-rounds N    最多轮询次数后退出，默认 0 (无限)
    --once            只跑一次
    --no-stop-on-hit  发现可购也不退出，继续监控

设计：
    - 不依赖 Appium，纯 adb shell uiautomator dump
    - 每次轮询前 force-stop io.appium.uiautomator2.server，避免冲突
    - 发现 ✅可购 票档：
        ① macOS 系统通知（osascript）
        ② 终端响铃（\\a 字符）
        ③ 终端高亮反色
        ④ 默认立即退出 —— 你应该立刻切到 launch.sh 抢票
"""
import subprocess
import time
import argparse
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# ANSI 颜色
RED = "\033[1;31m"
GRN = "\033[0;32m"
YEL = "\033[1;33m"
BLU = "\033[0;34m"
INV = "\033[7m"
NC = "\033[0m"

PRICE_CONTAINER_ID = "cn.damai:id/project_detail_perform_price_flowlayout"
SOLD_OUT_KEYWORDS = ("缺货登记", "已售罄", "票已售完", "无票", "暂无余票")
# 预约态：演出还没开售，票档只能"预约想看"，不是真的可买。
# 2026-08-31 实测：不判这个的话，预约期内每一轮都会把 7 个票档全报成"可购"（假警报）。
RESERVE_KEYWORDS = ("可预约", "已预约", "预约", "即将开售", "未开售", "即将预售")
DUMP_DEVICE_PATH = "/sdcard/damai_monitor_dump.xml"
DUMP_LOCAL_PATH = "/tmp/damai_monitor_dump.xml"


def run_cmd(cmd: list, timeout: int = 10) -> tuple:
    """执行 shell 命令，返回 (returncode, stdout, stderr)"""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"


def adb_dump_ui() -> bool:
    """force-stop uiautomator2 server + dump UI 到本地。返回是否成功。"""
    run_cmd(["adb", "shell", "am", "force-stop", "io.appium.uiautomator2.server"])
    time.sleep(0.5)
    rc, out, err = run_cmd(
        ["adb", "shell", "uiautomator", "dump", DUMP_DEVICE_PATH], timeout=15
    )
    if rc != 0:
        print(f"{RED}✗ adb dump 失败: {err.strip() or out.strip()}{NC}")
        return False
    rc, out, err = run_cmd(
        ["adb", "pull", DUMP_DEVICE_PATH, DUMP_LOCAL_PATH], timeout=10
    )
    if rc != 0:
        print(f"{RED}✗ adb pull 失败: {err.strip()}{NC}")
        return False
    return Path(DUMP_LOCAL_PATH).exists()


def parse_tickets(xml_path: str) -> list:
    """解析票档容器子节点。返回 [(index, sold_out, texts)] 列表。空列表 = 容器未渲染"""
    try:
        tree = ET.parse(xml_path)
    except ET.ParseError:
        return []
    for el in tree.iter("node"):
        if el.attrib.get("resource-id") == PRICE_CONTAINER_ID:
            results = []
            for i, child in enumerate(el):
                texts = []
                for sub in child.iter("node"):
                    t = sub.attrib.get("text", "").strip()
                    if t:
                        texts.append(t)
                joined = " ".join(texts)
                sold_out = any(kw in joined for kw in SOLD_OUT_KEYWORDS)
                reserving = any(kw in joined for kw in RESERVE_KEYWORDS)
                results.append((i, sold_out, reserving, texts))
            return results
    return []


def macos_notify(title: str, message: str) -> None:
    """macOS 系统通知（屏幕右上角弹窗 + 铃声）"""
    title = title.replace('"', '\\"')
    message = message.replace('"', '\\"')
    script = f'display notification "{message}" with title "{title}" sound name "Hero"'
    run_cmd(["osascript", "-e", script], timeout=5)


def beep(times: int = 5) -> None:
    """终端响铃"""
    for _ in range(times):
        sys.stdout.write("\a")
        sys.stdout.flush()
        time.sleep(0.2)


def render_status(round_num: int, tickets: list) -> list:
    """打印一轮状态。返回 available 列表"""
    ts = datetime.now().strftime("%H:%M:%S")
    if not tickets:
        print(f"{YEL}[{ts}] 第 {round_num} 轮: 票档容器未渲染（你不在票档列表页）{NC}")
        return []
    # 只有"既不售罄、也不处于预约态"才算真正可买
    available = [(i, txts) for i, sold, reserving, txts in tickets if not sold and not reserving]
    sold_count = sum(1 for _, sold, _, _ in tickets if sold)
    reserve_count = sum(1 for _, _, reserving, _ in tickets if reserving)

    if reserve_count and not available:
        print(
            f"{YEL}[{ts}] 第 {round_num} 轮: 预约态未开售"
            f"（{reserve_count}/{len(tickets)} 档显示可预约），继续等待{NC}",
            flush=True,
        )
        return []
    if available:
        print(f"{INV}{RED}[{ts}] 🎉 第 {round_num} 轮: 发现 {len(available)} 档可购票！{NC}")
        for i, txts in available:
            print(f"  {INV}{RED}>>> index={i}  文字={txts}{NC}")
    else:
        print(
            f"{ts} 第 {round_num} 轮: 全部售罄"
            f"（{sold_count}/{len(tickets)} 档显示缺货登记）",
            flush=True,
        )
    return available


def main():
    parser = argparse.ArgumentParser(description="大麦余票监控")
    parser.add_argument("--interval", type=int, default=30, help="轮询间隔秒数（默认 30）")
    parser.add_argument(
        "--max-rounds", type=int, default=0, help="最多轮询次数（0 = 无限）"
    )
    parser.add_argument("--once", action="store_true", help="只跑一次")
    parser.add_argument(
        "--no-stop-on-hit", action="store_true", help="发现可购也不退出，继续监控"
    )
    args = parser.parse_args()

    # 自检 adb
    rc, _, _ = run_cmd(["adb", "version"])
    if rc != 0:
        print(f"{RED}✗ adb 不可用，请先安装 platform-tools{NC}")
        sys.exit(1)
    rc, out, _ = run_cmd(["adb", "devices"])
    if "\tdevice" not in out:
        print(f"{RED}✗ 没有连接的 Android 设备{NC}")
        sys.exit(1)

    print(f"{BLU}🔍 大麦余票监控启动{NC}")
    print(f"{BLU}   轮询间隔: {args.interval}s  最大轮数: {args.max_rounds or '无限'}{NC}")
    print(
        f"{BLU}   ⚠️  开始前请手动在大麦 APP 打开目标场次，点底部\"立即预订\"让票档列表弹出{NC}"
    )
    print(f"{BLU}   按 Ctrl+C 退出监控{NC}\n")

    round_num = 0
    try:
        while True:
            round_num += 1
            if not adb_dump_ui():
                print(f"{YEL}  跳过本轮，{args.interval}s 后重试{NC}")
            else:
                tickets = parse_tickets(DUMP_LOCAL_PATH)
                available = render_status(round_num, tickets)
                if available:
                    titles = [f"index={i}" for i, _ in available]
                    macos_notify(
                        "🎫 大麦余票警报",
                        f"发现 {len(available)} 档可购票！立即去抢: {', '.join(titles)}",
                    )
                    beep(5)
                    print(f"{INV}{RED}>>> 立即切到 ./launch.sh 抢票！{NC}")
                    if not args.no_stop_on_hit:
                        print(f"{GRN}监控退出，可购票已发现{NC}")
                        sys.exit(0)
            if args.once or (args.max_rounds and round_num >= args.max_rounds):
                print(f"{BLU}监控达到最大轮数，退出{NC}")
                break
            for s in range(args.interval, 0, -1):
                print(f"  下次轮询 {s}s ...   ", end="\r", flush=True)
                time.sleep(1)
            print(" " * 30, end="\r")
    except KeyboardInterrupt:
        print(f"\n{YEL}🛑 用户中断，监控退出{NC}")


if __name__ == "__main__":
    main()
