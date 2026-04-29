#!/bin/bash
# 大麦抢票 - 环境检查脚本
# 使用方法: ./check_environment.sh

echo "🔍 检查大麦抢票环境..."
echo "================================"

# 检查Python
echo "🐍 检查Python环境..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python: $PYTHON_VERSION"
else
    echo "❌ Python未安装"
    exit 1
fi

# 检查Node.js
echo ""
echo "📦 检查Node.js环境..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
    
    # 检查版本是否兼容
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        echo "✅ Node.js版本兼容"
    else
        echo "⚠️  Node.js版本可能不兼容，建议升级到20.19.0+"
    fi
else
    echo "❌ Node.js未安装"
    exit 1
fi

# 检查Appium
echo ""
echo "🤖 检查Appium..."
if command -v appium &> /dev/null; then
    APPIUM_VERSION=$(appium --version)
    echo "✅ Appium: $APPIUM_VERSION"
else
    echo "❌ Appium未安装"
    echo "   安装命令: npm install -g appium"
    exit 1
fi

# 检查Android SDK / ADB（真机抢票最低要求：adb 可用即可）
echo ""
echo "📱 检查Android SDK / ADB..."
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
: "${ANDROID_SDK_ROOT:=$ANDROID_HOME}"
export ANDROID_HOME ANDROID_SDK_ROOT

ADB_BIN=""
if command -v adb &> /dev/null; then
    ADB_BIN="adb"
    echo "✅ ADB 可用 ($(command -v adb))"
elif [ -x "$ANDROID_HOME/platform-tools/adb" ]; then
    ADB_BIN="$ANDROID_HOME/platform-tools/adb"
    echo "✅ ADB 路径: $ADB_BIN"
    export PATH="$ANDROID_HOME/platform-tools:$PATH"
else
    echo "❌ ADB 未找到"
    echo "   方案A（仅真机抢票）: brew install --cask android-platform-tools"
    echo "   方案B（含模拟器）  : 安装 Android Studio 并设置 ANDROID_HOME"
    exit 1
fi

# 检查Android设备
echo ""
echo "📱 检查Android设备..."
DEVICES=$($ADB_BIN devices | grep -c "device$")
if [ $DEVICES -eq 0 ]; then
    echo "⚠️  未检测到Android设备"
    echo "   真机：插上 USB 数据线，在手机上确认 USB 调试授权"
    echo "   模拟器：\$ANDROID_HOME/emulator/emulator -avd <YourAVDName>"
else
    echo "✅ 检测到 $DEVICES 个Android设备"

    # 检查大麦APP
    if $ADB_BIN shell pm list packages | grep -q "cn.damai"; then
        echo "✅ 大麦APP已安装"
    else
        echo "⚠️  大麦APP未安装，请在设备上安装"
    fi
fi

# 检查Appium服务器
echo ""
echo "🌐 检查Appium服务器..."
if curl -s http://127.0.0.1:4723/status > /dev/null; then
    echo "✅ Appium服务器正在运行"
else
    echo "⚠️  Appium服务器未运行"
    echo "   启动命令: ./start_appium.sh"
fi

# 检查配置文件
echo ""
echo "📋 检查配置文件..."
if [ -f "damai_appium/config.jsonc" ]; then
    echo "✅ 配置文件存在"
    echo "   当前配置:"
    cat damai_appium/config.jsonc | grep -E '"keyword"|"city"|"users"' | head -3 | sed 's/^/   /'
else
    echo "❌ 配置文件不存在"
    echo "   请创建 damai_appium/config.jsonc 文件"
fi

echo ""
echo "================================"
echo "🎯 环境检查完成！"
echo ""
echo "📝 使用说明:"
echo "   1. 启动Appium: ./start_appium.sh"
echo "   2. 开始抢票: ./start_ticket_grabbing.sh"
echo ""
