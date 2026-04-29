#!/bin/bash
# 大麦抢票 daemon 模式 - 优雅停止
# 用法：./stop_daemon.sh             （只停 daemon，保留 Appium 长跑）
#       ./stop_daemon.sh --all       （顺便也停 Appium）
#       ./stop_daemon.sh -h          （帮助）
#
# 与 cleanup.sh 的区别：
#   cleanup.sh:      杀 Python + 杀 Appium + 删临时 + 切 if_commit=false + 提醒善后
#   stop_daemon.sh:  只停 daemon Python，Appium 默认保留 → 下次启动 daemon 更快
#
# 推荐用法：
#   - 只是临时打断 daemon → ./stop_daemon.sh （保留 Appium，下次启动节省 10-30s）
#   - 完全收工 → ./cleanup.sh -y

set -u

RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'

ALSO_STOP_APPIUM=0
for arg in "$@"; do
    case "$arg" in
        --all|-a) ALSO_STOP_APPIUM=1 ;;
        -h|--help) sed -n '2,15p' "$0" | sed 's/^# //'; exit 0 ;;
    esac
done

printf "${BLU}🛑 停止 daemon${NC}\n"
printf "============================================\n"

# ---------- 1. 找抢票相关 Python 进程 ----------
DAEMON_PIDS=$(pgrep -f "damai_app_v3_daemon.py" 2>/dev/null || true)
V2_PIDS=$(pgrep -f "damai_app_v2.py" 2>/dev/null || true)
MONITOR_PIDS=$(pgrep -f "damai_monitor.py" 2>/dev/null || true)

ALL_PY_PIDS=$(echo "$DAEMON_PIDS $V2_PIDS $MONITOR_PIDS" | xargs)

if [ -z "$ALL_PY_PIDS" ]; then
    printf "${GRN}✓ 无运行中的抢票脚本进程${NC}\n"
else
    printf "${YEL}发现以下抢票相关进程：${NC}\n"
    [ -n "$DAEMON_PIDS" ]  && printf "  daemon (v3) : ${DAEMON_PIDS}\n"
    [ -n "$V2_PIDS" ]      && printf "  v2 抢票     : ${V2_PIDS}\n"
    [ -n "$MONITOR_PIDS" ] && printf "  余票监控    : ${MONITOR_PIDS}\n"
    echo

    # 先 SIGTERM 优雅退出（让 daemon 跑 finally driver.quit()）
    printf "${BLU}→ 发送 SIGTERM 优雅退出（等 3 秒）${NC}\n"
    kill $ALL_PY_PIDS 2>/dev/null || true
    sleep 3

    REMAIN=$(pgrep -f "damai_app_v3_daemon.py|damai_app_v2.py|damai_monitor.py" 2>/dev/null || true)
    if [ -n "$REMAIN" ]; then
        printf "${YEL}→ 残留进程 ${REMAIN}，强制 SIGKILL${NC}\n"
        kill -9 $REMAIN 2>/dev/null || true
        sleep 1
    fi

    if pgrep -f "damai_app_v3_daemon.py|damai_app_v2.py|damai_monitor.py" >/dev/null 2>&1; then
        printf "${RED}✗ 仍有残留，请手动检查${NC}\n"
    else
        printf "${GRN}✅ Python 抢票进程全部清理${NC}\n"
    fi
fi
echo

# ---------- 2. driver session 清理（通过 Appium API） ----------
if curl -s "http://127.0.0.1:4723/sessions" >/dev/null 2>&1; then
    SESSIONS=$(curl -s "http://127.0.0.1:4723/sessions" 2>/dev/null | grep -oE '"[a-f0-9-]{30,}"' | tr -d '"')
    if [ -n "$SESSIONS" ]; then
        printf "${YEL}发现 Appium 残留 session：${NC}\n"
        for sid in $SESSIONS; do
            printf "  $sid → 关闭中..."
            curl -s -X DELETE "http://127.0.0.1:4723/session/$sid" >/dev/null 2>&1 && \
                printf " ${GRN}✓${NC}\n" || printf " ${RED}✗${NC}\n"
        done
    else
        printf "${GRN}✓ Appium 无残留 session${NC}\n"
    fi
else
    printf "${GRN}✓ Appium 不在跑，无 session 可清${NC}\n"
fi
echo

# ---------- 3. 可选：也停 Appium ----------
if [ $ALSO_STOP_APPIUM -eq 1 ]; then
    printf "${YEL}→ --all 模式：同时停止 Appium server${NC}\n"
    pkill -f "appium" 2>/dev/null && sleep 2
    pkill -9 -f "appium" 2>/dev/null || true
    printf "${GRN}✅ Appium 已停${NC}\n"
else
    if curl -s "http://127.0.0.1:4723/status" >/dev/null 2>&1; then
        printf "${BLU}→ Appium 仍在跑（保留长驻 = 下次启动 daemon 更快）${NC}\n"
        printf "  完全停掉用：${YEL}./stop_daemon.sh --all${NC} 或 ${YEL}./cleanup.sh -y${NC}\n"
    fi
fi

echo
printf "============================================\n"
printf "${GRN}🏁 daemon 已停${NC}\n"
printf "下次启动：${YEL}./launch_daemon.sh${NC}\n"
