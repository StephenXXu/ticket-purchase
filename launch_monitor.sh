#!/bin/bash
# 大麦「回流票监控」一键启动
# 用法：./launch_monitor.sh [轮询间隔秒，默认 20]
#
# 定位（重要）：
#   本脚本只做「监控 + 报警」，不自动下单。
#   适用场景 = 开售后刷回流票（退票 / 超时未付款释放的零散票）。
#   ❌ 不适用于开售瞬间的秒杀 —— 秒杀请人工操作，理由见 doc/实施文档-回流监控与秒杀分工.md
#
# 工作流：
#   1. 自检 adb / 设备 / 大麦 / 页面状态
#   2. 提示你把大麦停在票档列表页
#   3. 循环 dump 票档容器，识别 售罄 / 预约态 / 可购 三种状态
#   4. 一旦出现真正可购的票档 → macOS 通知 + 响铃 + 终端高亮 → 你手动接管下单

set -u
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'
INTERVAL="${1:-20}"

: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
: "${ANDROID_SDK_ROOT:=$ANDROID_HOME}"
export ANDROID_HOME ANDROID_SDK_ROOT
[ -d "$ANDROID_HOME/platform-tools" ] && export PATH="$ANDROID_HOME/platform-tools:$PATH"

die() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }
ok()  { printf "${GRN}✓ %s${NC}\n" "$1"; }
say() { printf "${BLU}→ %s${NC}\n" "$1"; }
warn(){ printf "${YEL}⚠ %s${NC}\n" "$1"; }

printf "${BLU}🔍 大麦回流票监控（只报警，不下单）${NC}\n"
printf "============================================\n\n"

# ---------- 1. 自检 ----------
say "1/3 环境自检"
command -v adb >/dev/null 2>&1 || die "adb 未安装（brew install --cask android-platform-tools）"
command -v poetry >/dev/null 2>&1 || die "poetry 未安装（brew install poetry）"

ADB_LIST=$(adb devices | tail -n +2 | grep -v '^[[:space:]]*$')
UDID=${DAMAI_UDID:-$(echo "$ADB_LIST" | awk '$2=="device"{print $1; exit}')}
if [ -z "$UDID" ]; then
    echo "$ADB_LIST" | grep -q "unauthorized" && die "设备 unauthorized —— 手机上点「允许 USB 调试」并勾一律允许"
    echo "$ADB_LIST" | grep -q "offline"      && die "设备 offline —— 拔插数据线后重跑"
    die "adb 认不到设备 —— 检查 USB 调试是否打开、USB 模式是否为「传输文件」"
fi
adb -s "$UDID" shell pm list packages 2>/dev/null | grep -q "cn.damai" || die "设备未安装大麦 APP"
DEV_MODEL=$(adb -s "$UDID" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
export DAMAI_UDID="$UDID"
ok "设备就绪: ${DEV_MODEL} (${UDID})"

# ---------- 2. 页面与屏幕状态 ----------
say "2/3 页面状态检查"
FOCUS=$(adb -s "$UDID" shell dumpsys window 2>/dev/null | grep -m1 mCurrentFocus | tr -d '\r')
case "$FOCUS" in
    *NcovSkuActivity*) ok "已在 SKU 票档页，监控可直接读到票档容器" ;;
    *cn.damai*)        warn "大麦在前台但不在票档页 —— 请点底部购买按钮让票档列表出现，否则每轮都读不到容器" ;;
    *)                 warn "大麦不在前台（当前: ${FOCUS#*mCurrentFocus=}）—— 监控期间必须保持大麦在票档页" ;;
esac

# 长时间监控必须防锁屏：USB 供电时保持常亮
adb -s "$UDID" shell svc power stayon usb >/dev/null 2>&1 \
    && ok "已设置 USB 供电常亮（监控结束后可用 adb shell svc power stayon false 还原）" \
    || warn "设置常亮失败，请手动把手机息屏时间调长，锁屏会导致读不到控件"
echo

# ---------- 3. 启动监控 ----------
say "3/3 启动监控（间隔 ${INTERVAL}s，Ctrl+C 退出）"
cat <<TIP
  监控会区分三种状态：
    ${YEL}预约态${NC}  票档显示「可预约」= 还没开售，继续等
    售罄     票档显示「缺货登记」= 有票位但无票，继续刷
    ${GRN}可购${NC}    既不售罄也非预约态 = 回流票出现 → 每轮持续报警，你立刻手动下单

TIP
printf "${YEL}回车开始监控${NC}"; read -r
echo
cd damai_appium && poetry run python damai_monitor.py --interval "$INTERVAL" --no-stop-on-hit
