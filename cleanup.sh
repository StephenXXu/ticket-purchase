#!/bin/bash
# 大麦抢票 - 收尾清理脚本
# 用法：./cleanup.sh           （交互式：每步问 y/N）
#       ./cleanup.sh -y         （非交互，全部执行）
#       ./cleanup.sh --dry-run  （只打印不执行）

set -u

# ANSI 颜色
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'

YES_ALL=0
DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        -y|--yes)     YES_ALL=1 ;;
        -n|--dry-run) DRY_RUN=1 ;;
        -h|--help)    sed -n '2,5p' "$0" | sed 's/^# //'; exit 0 ;;
    esac
done

ask() {
    # ask "问题" -> 0 表示 yes，1 表示 no
    local prompt="$1"
    [ $YES_ALL -eq 1 ] && return 0
    read -p "$(printf "${YEL}🤔 %s (y/N): ${NC}" "$prompt")" -n 1 -r ans
    echo
    [[ "$ans" =~ ^[Yy]$ ]]
}

run() {
    # run "描述" "命令"
    local desc="$1"; local cmd="$2"
    if [ $DRY_RUN -eq 1 ]; then
        printf "${BLU}[DRY-RUN] %s${NC}\n  $ %s\n" "$desc" "$cmd"
    else
        printf "${BLU}→ %s${NC}\n" "$desc"
        eval "$cmd"
    fi
}

printf "${BLU}🧹 大麦抢票收尾清理${NC}\n"
printf "============================================\n\n"

# ---------- 1. 杀 Python 抢票脚本进程 ----------
PY_PIDS=$(pgrep -f "damai_app_v2.py" 2>/dev/null || true)
if [ -n "$PY_PIDS" ]; then
    printf "${YEL}发现抢票脚本进程：${NC}\n"
    ps -fp $PY_PIDS 2>/dev/null | tail -n +2
    if ask "杀掉以上 Python 抢票脚本进程？"; then
        run "kill damai_app_v2.py" "kill $PY_PIDS 2>/dev/null; sleep 1; pkill -9 -f damai_app_v2.py 2>/dev/null || true"
        printf "${GRN}✅ Python 抢票进程已清理${NC}\n"
    fi
else
    printf "${GRN}✓ 无 Python 抢票脚本进程${NC}\n"
fi
echo

# ---------- 2. 杀 Appium server ----------
AP_PIDS=$(pgrep -f "appium" 2>/dev/null || true)
if [ -n "$AP_PIDS" ]; then
    printf "${YEL}发现 Appium 进程：${NC}\n"
    ps -fp $AP_PIDS 2>/dev/null | tail -n +2
    if ask "杀掉 Appium server？（下次抢票要重启）"; then
        run "kill appium" "pkill -f appium 2>/dev/null; sleep 2; pkill -9 -f appium 2>/dev/null || true"
        # 验证 4723 已释放
        if lsof -i :4723 >/dev/null 2>&1; then
            printf "${RED}✗ 4723 端口仍被占用，强制释放${NC}\n"
            run "force release 4723" "lsof -ti :4723 | xargs kill -9 2>/dev/null || true"
        fi
        printf "${GRN}✅ Appium 已停止，4723 端口已释放${NC}\n"
    fi
else
    printf "${GRN}✓ 无 Appium 进程${NC}\n"
fi
echo

# ---------- 3. 清理 /tmp 临时 dump ----------
TMP_FILES=$(ls /tmp/damai*.xml /tmp/d2.xml /tmp/xuliang*.xml 2>/dev/null || true)
if [ -n "$TMP_FILES" ]; then
    printf "${YEL}发现临时 UI dump 文件：${NC}\n"
    ls -la $TMP_FILES 2>/dev/null
    if ask "删除以上临时文件？"; then
        run "rm tmp dumps" "rm -f $TMP_FILES"
        # 也清掉手机端 sdcard 上的 dump
        run "rm /sdcard/*.xml on device" "adb shell 'rm -f /sdcard/window_dump.xml /sdcard/dump_*.xml /sdcard/d*.xml 2>/dev/null' 2>/dev/null || true"
        printf "${GRN}✅ 临时 dump 已清理${NC}\n"
    fi
else
    printf "${GRN}✓ 无临时 dump 文件${NC}\n"
fi
echo

# ---------- 4. 检查未付款订单（提醒） ----------
printf "${YEL}📋 提醒：手动检查大麦订单状态${NC}\n"
printf "  打开大麦 APP → 我的 → 全部订单\n"
printf "  - 有「待付款」的 → 30 分钟内付款，否则订单回库\n"
printf "  - 有「已支付」的 → 完美，抢成功了\n"
printf "  - 有「已关闭/已取消」的 → 可以忽略\n"
echo

# ---------- 5. 关闭 USB 调试（提醒） ----------
DEVICES=$(adb devices 2>/dev/null | grep -c "device$" 2>/dev/null || echo "0")
if [ "$DEVICES" -gt 0 ]; then
    printf "${YEL}📱 检测到 ${DEVICES} 台设备仍连接${NC}\n"
    if ask "停止 adb daemon（下次插设备会自动启动）？"; then
        run "adb kill-server" "adb kill-server 2>/dev/null || true"
        printf "${GRN}✅ adb daemon 已停止${NC}\n"
    fi
    printf "${YEL}🔒 抢票后建议手机端关闭 USB 调试${NC}\n"
    printf "  路径：设置 → 系统 → 开发者选项 → USB 调试 → 关闭\n"
    printf "  原因：避免日常使用时被恶意 App 通过 ADB 利用\n"
else
    printf "${GRN}✓ 无 ADB 设备连接${NC}\n"
fi
echo

# ---------- 6. 把 if_commit_order 切回 false（防误下单）----------
CFG=damai_appium/config.jsonc
if [ -f "$CFG" ] && grep -q '"if_commit_order": *true' "$CFG"; then
    printf "${YEL}⚠️  config.jsonc 当前 if_commit_order=true（正式抢票模式）${NC}\n"
    if ask "切回 false（避免下次误开脚本就真下单）？"; then
        if [ $DRY_RUN -eq 1 ]; then
            printf "${BLU}[DRY-RUN] sed 'true → false' on %s${NC}\n" "$CFG"
        else
            sed -i.bak 's/"if_commit_order": *true/"if_commit_order": false/' "$CFG"
            rm -f "${CFG}.bak"
            printf "${GRN}✅ if_commit_order 已切回 false${NC}\n"
        fi
    fi
else
    printf "${GRN}✓ if_commit_order 已是 false 或文件不存在${NC}\n"
fi
echo

printf "============================================\n"
printf "${GRN}🏁 清理完成${NC}\n"
printf "下次抢票流程：\n"
printf "  1. ./check_environment.sh   # 体检\n"
printf "  2. ./start_appium.sh        # 起 server\n"
printf "  3. ./start_ticket_grabbing.sh\n"
