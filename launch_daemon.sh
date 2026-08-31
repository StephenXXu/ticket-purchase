#!/bin/bash
# 大麦抢票 daemon 模式 - 一键启动
# 用法：./launch_daemon.sh
#
# 工作流：
#   1. 自检（adb/appium/poetry/config/设备/大麦APP）
#   2. Appium 已跑就复用，否则后台启动等就绪
#   3. 显示当前 config + 安全开关状态
#   4. 列开抢前清单
#   5. 直接进入 v3 daemon REPL（[Enter]抢票 / c重载 / s查config / q退出）
#
# 与 launch.sh 区别：
#   - launch.sh：跑 v2 一次（每次都闪屏）
#   - launch_daemon.sh：进 v3 REPL（首次启动闪一下，第 2 次起完全无闪屏）
#
# 适合场景：演练 / 刷回流 / 连续抢相邻场次

set -u

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'

CFG=damai_appium/config.jsonc
APPIUM_PORT=4723
APPIUM_LOG=/tmp/appium.log

: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
: "${ANDROID_SDK_ROOT:=$ANDROID_HOME}"
export ANDROID_HOME ANDROID_SDK_ROOT
[ -d "$ANDROID_HOME/platform-tools" ] && export PATH="$ANDROID_HOME/platform-tools:$PATH"

die() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }
ok()  { printf "${GRN}✓ %s${NC}\n" "$1"; }
say() { printf "${BLU}→ %s${NC}\n" "$1"; }
warn(){ printf "${YEL}⚠ %s${NC}\n" "$1"; }

printf "${BLU}🚀 大麦抢票 daemon 模式启动${NC}\n"
printf "${BLU}   driver 长驻，第 2 次起完全无闪屏 + 0.5-1 秒完成${NC}\n"
printf "============================================\n\n"

# ---------- 1. 快速自检 ----------
say "1/5 快速自检"
command -v adb     >/dev/null 2>&1 || die "adb 未安装（brew install --cask android-platform-tools）"
command -v appium  >/dev/null 2>&1 || die "appium 未安装（npm i -g appium）"
command -v poetry  >/dev/null 2>&1 || die "poetry 未安装（brew install poetry）"
[ -f "$CFG" ]                       || die "$CFG 不存在"
[ -f "damai_appium/damai_app_v3_daemon.py" ] || die "v3 daemon 脚本不存在"

# 设备状态细分：device / unauthorized / offline，报错要能直接指导下一步
ADB_LIST=$(adb devices | tail -n +2 | grep -v '^[[:space:]]*$')
UDID=${DAMAI_UDID:-$(echo "$ADB_LIST" | awk '$2=="device"{print $1; exit}')}
if [ -z "$UDID" ]; then
    if echo "$ADB_LIST" | grep -q "unauthorized"; then
        die "设备处于 unauthorized —— 手机上点「允许 USB 调试」并勾选「一律允许」后重跑"
    elif echo "$ADB_LIST" | grep -q "offline"; then
        die "设备 offline —— 拔插数据线或 adb kill-server && adb start-server 后重跑"
    else
        die "adb 认不到设备 —— 检查：① 开发者选项 USB 调试已开（Flyme 还需开 USB 安装）② USB 模式选「传输文件/MTP」不是「仅充电」③ 用数据线不是充电线"
    fi
fi
DEV_MODEL=$(adb -s "$UDID" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
DEV_REL=$(adb -s "$UDID" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')
adb -s "$UDID" shell pm list packages 2>/dev/null | grep -q "cn.damai" || die "设备 $UDID 未安装大麦 APP"
DAMAI_VER=$(adb -s "$UDID" shell dumpsys package cn.damai 2>/dev/null | grep -m1 versionName | tr -d '\r ' | cut -d= -f2)
export DAMAI_UDID="$UDID"
ok "设备就绪: ${DEV_MODEL} / Android ${DEV_REL} / udid=${UDID} / 大麦 ${DAMAI_VER:-未知}"

# 屏幕锁屏会让 uiautomator 抓不到控件，检查一下当前是否亮屏
SCREEN_ON=$(adb -s "$UDID" shell dumpsys deviceidle 2>/dev/null | grep -m1 "mScreenOn=" | tr -d '\r' | cut -d= -f2)
if [ "$SCREEN_ON" = "false" ]; then
    warn "屏幕当前是熄的，抢票期间必须保持亮屏（可执行 adb -s $UDID shell svc power stayon usb 让 USB 供电时常亮）"
fi
echo

# ---------- 2. 确保 Appium 已跑 ----------
say "2/5 检查 Appium server"
if curl -s "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1; then
    ok "Appium 已在跑（${APPIUM_PORT}），daemon 可直接复用"
else
    warn "Appium 未运行，后台启动中..."
    nohup appium --port ${APPIUM_PORT} > "$APPIUM_LOG" 2>&1 &
    APPIUM_PID=$!
    for i in $(seq 1 30); do
        if curl -s "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1; then
            ok "Appium 已就绪（PID=$APPIUM_PID, 日志 $APPIUM_LOG）"
            break
        fi
        sleep 1
    done
    curl -s "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1 || die "Appium 30s 仍未就绪，看 tail -f $APPIUM_LOG"
fi
echo

# ---------- 3. 显示 config 摘要 + 安全检查 ----------
say "3/5 当前 config"
printf "  ${BLU}$CFG${NC}\n"
sed -E 's/^/    /' "$CFG"
echo

IF_COMMIT=$(grep -E '"if_commit_order"' "$CFG" | grep -oE 'true|false')
if [ "$IF_COMMIT" = "true" ]; then
    printf "  ${RED}🔴 if_commit_order = true → 真下单模式${NC}\n"
    printf "  ${YEL}     daemon 中每次按 Enter 都会真下单！${NC}\n"
elif [ "$IF_COMMIT" = "false" ]; then
    printf "  ${GRN}🟢 if_commit_order = false → 冒烟模式（不真下单，反复演练安全）${NC}\n"
fi
echo

# ---------- 4. 准备清单 ----------
say "4/5 daemon 启动前确认"
cat <<EOF
  ☐ 大麦 APP 已打开，已登录
  ☐ 已切到目标场次的 ${YEL}演出详情页${NC}（看到底部"立即购买/立即预订"按钮）
  ☐ 没有手动点过底部购买按钮
  ☐ 屏幕保持亮起（daemon 长驻期间手机不要锁屏）
  ☐ 准备好反复按 Enter 演练 / 改 config 后按 c 重载
EOF
echo

# ---------- 5. 启动 daemon ----------
say "5/5 进入 v3 daemon REPL"
printf "${YEL}🤔 准备好按回车启动 daemon？(进入后用 [Enter]/c/s/q 操作)${NC}"
read -r
echo
printf "${BLU}─────── daemon REPL 输出 ───────${NC}\n"
cd damai_appium && poetry run python damai_app_v3_daemon.py
EXIT_CODE=$?
cd ..
printf "${BLU}─────── daemon 已退出（exit=${EXIT_CODE}）───────${NC}\n"

echo
say "下一步："
printf "  • 抢到票 → 立刻去手机付款（30s 内）\n"
printf "  • 再演练 → ${YEL}./launch_daemon.sh${NC}\n"
printf "  • 完全收工 → ${YEL}./cleanup.sh -y${NC}（杀 Appium + 删临时 + 切 if_commit=false）\n"
printf "  • 仅停 daemon → ${YEL}./stop_daemon.sh${NC}（保留 Appium 长跑，下次启动 daemon 更快）\n"
