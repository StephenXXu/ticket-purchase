#!/bin/bash
# 大麦抢票 - 一键启动（自检 + 确保 Appium + 启动抢票脚本）
# 用法：./launch.sh
#
# 工作流：
#   1. 快速自检（adb/appium/poetry/config.jsonc/设备/大麦APP）
#   2. Appium 已跑就复用，否则后台启动等就绪
#   3. 显示当前 config 摘要 + 安全开关状态
#   4. 你按回车 → 立即跑抢票脚本（提前 30 秒按可让脚本卡在"等待开抢"轮询）
#
# ⚠️ 与 start_ticket_grabbing.sh 的区别：
#   - 那个要求 Appium 已经在跑、要按 y 确认
#   - 这个自动起 Appium、只按 1 次回车

set -u

RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'

CFG=damai_appium/config.jsonc
APPIUM_PORT=4723
APPIUM_LOG=/tmp/appium.log

# Android 环境
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
: "${ANDROID_SDK_ROOT:=$ANDROID_HOME}"
export ANDROID_HOME ANDROID_SDK_ROOT
[ -d "$ANDROID_HOME/platform-tools" ] && export PATH="$ANDROID_HOME/platform-tools:$PATH"

die() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }
ok()  { printf "${GRN}✓ %s${NC}\n" "$1"; }
say() { printf "${BLU}→ %s${NC}\n" "$1"; }
warn(){ printf "${YEL}⚠ %s${NC}\n" "$1"; }

printf "${BLU}🚀 大麦抢票一键启动${NC}\n"
printf "============================================\n\n"

# ---------- 1. 快速自检 ----------
say "1/5 快速自检"
command -v adb     >/dev/null 2>&1 || die "adb 未安装（brew install --cask android-platform-tools）"
command -v appium  >/dev/null 2>&1 || die "appium 未安装（npm i -g appium）"
command -v poetry  >/dev/null 2>&1 || die "poetry 未安装（brew install poetry）"
[ -f "$CFG" ]                       || die "$CFG 不存在"
[ -f "damai_appium/damai_app_v2.py" ] || die "脚本 damai_app_v2.py 不存在"

DEVICES=$(adb devices | grep -c "device$")
[ "$DEVICES" -gt 0 ] || die "没有 Android 设备连接（adb devices 看不到）"
adb shell pm list packages | grep -q "cn.damai" || die "大麦 APP 未安装"
ok "工具链/配置/设备/大麦APP 全就绪（设备 ${DEVICES} 台）"
echo

# ---------- 2. 确保 Appium 已跑 ----------
say "2/5 检查 Appium server"
if curl -s "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1; then
    ok "Appium 已在跑（${APPIUM_PORT}）"
else
    warn "Appium 未运行，后台启动中..."
    nohup appium --port ${APPIUM_PORT} > "$APPIUM_LOG" 2>&1 &
    APPIUM_PID=$!
    # 等就绪，最多 30 秒
    for i in $(seq 1 30); do
        if curl -s "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1; then
            ok "Appium 已就绪（PID=$APPIUM_PID, 日志 $APPIUM_LOG）"
            break
        fi
        sleep 1
    done
    curl -s "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1 || die "Appium 启动 30s 仍未就绪，看日志: tail -f $APPIUM_LOG"
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
    printf "  ${YEL}     一旦运行，第 7 步会真实点击\"立即提交\"按钮${NC}\n"
elif [ "$IF_COMMIT" = "false" ]; then
    printf "  ${GRN}🟢 if_commit_order = false → 冒烟模式（不真下单）${NC}\n"
else
    warn "if_commit_order 字段未识别"
fi
echo

# ---------- 4. 准备清单 ----------
say "4/5 开抢前最后确认（按 Ctrl+C 退出）"
cat <<EOF
  ☐ 大麦 APP 已打开，已登录
  ☐ 已切到目标场次的 ${YEL}演出详情页${NC}（看到底部"立即购买/立即预订"按钮的那屏）
  ☐ 没有手动点过底部购买按钮
  ☐ 屏幕保持亮起
  ☐ 手机握在手里，指纹位置准备好（订单出来后必须 30s 内付款）
EOF
echo

# ---------- 5. 启动抢票 ----------
say "5/5 启动抢票脚本"
printf "${YEL}🤔 准备好按回车开始？(此后脚本会自动等开抢按钮激活)${NC}"
read -r
echo
printf "${BLU}─────── 抢票脚本输出 ───────${NC}\n"
cd damai_appium && poetry run python damai_app_v2.py
EXIT_CODE=$?
cd ..
printf "${BLU}─────── 脚本结束（exit=${EXIT_CODE}）───────${NC}\n"

echo
say "下一步："
printf "  • 抢到票 → 立刻去手机付款（30s 内）\n"
printf "  • 没抢到 → ${YEL}./cleanup.sh${NC} 收尾，或换场次重试 ${YEL}./launch.sh${NC}\n"
