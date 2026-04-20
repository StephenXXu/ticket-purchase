/**
 * 猫眼/大麦/纷玩岛 抢票按钮坐标自动校准脚本
 *
 * 用法：
 *   1. 把本文件导入到手机 AutoX.js（通过 Web IDE 或 /sdcard/Scripts/）
 *   2. 打开目标 APP（猫眼/大麦/纷玩岛），进入演出详情页 或 票档选择页
 *   3. 回到 AutoX.js，运行本脚本
 *   4. 屏幕会 toast 显示 ConfirmX / ConfirmY
 *   5. 控制台（Console）会打印完整结果，可复制粘贴
 *   6. 把 ConfirmX / ConfirmY 填进 MaoYanGoNew.js 等脚本
 *
 * 依赖：AutoX.js 6.5.x 及以上，需已开启无障碍权限。
 */

auto.waitFor();

// ========== 设备信息 ==========
console.log("====================================");
console.log("设备分辨率: " + device.width + " x " + device.height);
console.log("====================================");
toast("开始扫描底部按钮...");

// ========== 可识别的按钮文字（覆盖多平台多状态） ==========
var buttonKeywords = [
    // 猫眼
    "立即预约", "预约抢票", "立即预订", "立即购票",
    "选座购票", "立即购买", "特惠购票", "缺货登记",
    "确认选座", "立即支付", "确认",
    // 大麦
    "立即购票", "立即预订",
    // 纷玩岛
    "立即抢票", "我要购买",
    // 票星球
    "立即购买", "立即下单"
];

// ========== 查找匹配的按钮 ==========
var found = null;
var foundText = "";

for (var i = 0; i < buttonKeywords.length; i++) {
    var kw = buttonKeywords[i];
    var node = text(kw).findOne(500);
    if (node) {
        var b = node.bounds();
        // 过滤：必须在屏幕下半部分（Y > 屏幕高度的 50%）
        if (b.centerY() > device.height * 0.5) {
            // 过滤：宽度必须 > 100（不是小图标）
            if ((b.right - b.left) > 100) {
                found = node;
                foundText = kw;
                break;
            }
        }
    }
}

// ========== 输出结果 ==========
if (found) {
    var b = found.bounds();
    var cx = b.centerX();
    var cy = b.centerY();
    var width = b.right - b.left;
    var height = b.bottom - b.top;

    var output = "\n====== 校准结果 ======"
        + "\n按钮文字: " + foundText
        + "\nbounds: (" + b.left + "," + b.top + "," + b.right + "," + b.bottom + ")"
        + "\n尺寸: " + width + " x " + height
        + "\n====== 复制下面 2 行填进 MaoYanGoNew.js ======"
        + "\nvar ConfirmX = " + cx + ";"
        + "\nvar ConfirmY = " + cy + ";"
        + "\n============================================";

    console.log(output);

    toast("[" + foundText + "]\nConfirmX=" + cx + "\nConfirmY=" + cy);
    sleep(3000);
    toast("已打印到控制台，下拉通知可看");

    // ========== 顺便尝试取票档坐标（调试用） ==========
    sleep(1500);
    console.log("\n------ 扫描票档区域（供 debugTicketClick 使用） ------");
    var priceNode = textMatches(/^¥?\s*\d{2,5}(\.\d+)?$/).findOne(1500);
    if (!priceNode) {
        priceNode = textContains("¥").findOne(1500);
    }
    if (priceNode) {
        var pb = priceNode.bounds();
        console.log("检测到票价: " + priceNode.text());
        console.log("var debugTicketClickX = " + pb.centerX() + ";");
        console.log("var debugTicketClickY = " + pb.centerY() + ";");
        toast("票档坐标已打印\n价格: " + priceNode.text());
    } else {
        console.log("未找到票价区域（可能不在票档选择页）");
    }

} else {
    console.log("\n未找到任何匹配按钮");
    console.log("请检查：");
    console.log("  1. 已授予 AutoX.js 无障碍权限？");
    console.log("  2. 当前是否停留在演出详情页 或 票档选择页？");
    console.log("  3. 若目标按钮文字不在列表中，请编辑脚本 buttonKeywords 数组加入");

    toast("没找到按钮，请进入演出详情页再运行");
}

console.log("\n扫描结束。");
