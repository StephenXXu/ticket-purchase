/**
 * 大麦 APP 抢票脚本（AutoX.js 版）
 *
 * 目标演唱会：徐良"时间折叠"巡回演唱会-成都站
 * 场馆：成都·五粮液文化体育中心综合体育馆
 * 日期：2026-05-05
 * 观演人：高小丽、徐兴院
 *
 * 风格参考：Pactum7/ticket-grabbing/MaoYan/MaoYanGoNew.js
 *
 * 使用方法：
 *   1. 提前在大麦 APP 里：登录账号 + 添加观演人（高小丽、徐兴院）+ 绑定免密支付
 *   2. AutoX.js 打开本脚本
 *   3. 手动打开大麦 APP，进入目标演出"详情页"
 *   4. 切回 AutoX.js → 运行
 *   5. 脚本会循环检测"立即购票/立即预订"按钮出现 → 自动点击完整流程
 *   6. 到支付页会振动+ toast 提醒你付款
 *
 * 首次跑务必 isDebug = true 用冷门演出测试流程
 *
 * 依赖：AutoX.js 6.5.x+，需无障碍、悬浮窗、自启动权限
 */

auto.waitFor();

// ============================================================
// 用户配置区 ==================================================
// ============================================================

// 坐标（已校准 1080×2331 屏幕）
var ConfirmX = 602;
var ConfirmY = 2241;

// 目标演出信息
var TargetKeyword = "徐良 时间折叠";        // 搜索关键词（仅备用，实际走详情页）
var TargetCity    = "成都";                 // 城市
var TargetDate    = "05月05日";             // 大麦显示的日期格式
var TargetPrice   = "380";                  // 目标票档（元）
var TargetViewers = ["高小丽", "徐兴院"];    // 观演人（和大麦 APP 里一字不差）

// 调试开关（true = 只走流程不提交订单，先用冷门演出测试）
var isDebug = true;

// 刷新节奏
var RefreshIntervalMs = 200;

// ============================================================
// 常量（一般不需改） ==========================================
// ============================================================
var DamaiPackage = "cn.damai";

// 大麦各状态下的"购票"按钮关键词（包含变体）
var BuyButtonKeywords = [
    "立即预订", "立即购票", "立即购买",
    "选座购票", "特惠购票", "特惠预订",
    "我要买", "购买"
];

// 预约按钮（开售前显示，脚本不触发此）
var PreOrderKeywords = ["立即预约", "预约抢票", "预约"];

// 售罄按钮
var SoldOutKeywords = ["缺货登记", "到货提醒"];

// 订单流程按钮
var NextStepKeywords = ["下一步", "确定", "确认", "去结算"];
var SubmitOrderKeywords = ["提交订单", "立即支付", "去支付"];

// ============================================================
// 工具函数 ====================================================
// ============================================================

function log(msg) {
    console.log("[" + new Date().toLocaleTimeString() + "] " + msg);
}

// 在关键词数组里找控件，命中就返回
function findByKeywords(keywords, timeoutMs) {
    timeoutMs = timeoutMs || 500;
    for (var i = 0; i < keywords.length; i++) {
        var node = text(keywords[i]).findOne(Math.max(50, timeoutMs / keywords.length));
        if (node) {
            return { node: node, text: keywords[i] };
        }
    }
    return null;
}

// 判断 APP 是否在前台
function ensureDamaiForeground() {
    if (currentPackage() !== DamaiPackage) {
        log("大麦不在前台，启动中...");
        app.launchPackage(DamaiPackage);
        sleep(2500);
    }
}

// 兜底点击（按文字找不到时用坐标）
function fallbackClick() {
    log("兜底坐标点击 (" + ConfirmX + "," + ConfirmY + ")");
    click(ConfirmX, ConfirmY);
}

// ============================================================
// 主流程 ======================================================
// ============================================================

log("================ 开始抢票 ================");
log("目标: " + TargetKeyword + " / " + TargetCity + " / " + TargetDate);
log("票价: " + TargetPrice + " 观演人: " + TargetViewers.join(","));
log("调试模式: " + (isDebug ? "开" : "关"));
log("==========================================");

ensureDamaiForeground();
toast("开始监听购票按钮...");

// ---------- Step 1: 等待"立即购票"按钮出现 ----------
var buyFound = null;
var loopCount = 0;

while (!buyFound) {
    loopCount++;

    // 检测已售罄
    var soldOut = findByKeywords(SoldOutKeywords, 100);
    if (soldOut) {
        if (loopCount % 20 === 0) {
            log("当前状态: 缺货登记 (已循环 " + loopCount + " 次，继续等待)");
        }
        // 下拉刷新页面
        swipe(device.width / 2, 500, device.width / 2, 1500, 300);
        sleep(RefreshIntervalMs);
        continue;
    }

    // 检测预约状态（还没开售）
    var preOrder = findByKeywords(PreOrderKeywords, 100);
    if (preOrder) {
        if (loopCount % 20 === 0) {
            log("当前状态: 预约中 (等待开售)");
        }
        sleep(RefreshIntervalMs);
        continue;
    }

    // 检测购票按钮
    buyFound = findByKeywords(BuyButtonKeywords, 100);
    if (buyFound) {
        log("检测到购票按钮: " + buyFound.text);
        break;
    }

    sleep(RefreshIntervalMs);

    // 兜底：每 100 次循环检查一次 APP 是否还在前台
    if (loopCount % 100 === 0) {
        ensureDamaiForeground();
    }
}

// ---------- Step 2: 点击购票按钮 ----------
log("点击购票按钮: " + buyFound.text);
buyFound.node.click();
sleep(800);

// ---------- Step 3: 选场次日期 ----------
log("查找目标日期: " + TargetDate);
var dateNode = text(TargetDate).findOne(3000);
if (dateNode) {
    log("找到日期控件，点击");
    dateNode.click();
    sleep(500);
} else {
    // 尝试模糊匹配（"05月05日"/"05-05"/"5月5日"等变体）
    var altDateFormats = [
        "05-05", "5月5日", "5.5", "05/05", "2026-05-05"
    ];
    var altDate = findByKeywords(altDateFormats, 2000);
    if (altDate) {
        log("通过备选格式匹配到日期: " + altDate.text);
        altDate.node.click();
        sleep(500);
    } else {
        log("未找到目标日期，可能页面只有单一场次（继续）");
    }
}

// ---------- Step 4: 选票档价位 ----------
log("查找目标票档: " + TargetPrice + "元");
var priceCandidates = [
    TargetPrice + "元",
    "¥" + TargetPrice,
    "￥" + TargetPrice,
    TargetPrice + ".00",
    TargetPrice
];
var priceNode = findByKeywords(priceCandidates, 3000);
if (priceNode) {
    log("找到票档: " + priceNode.text);
    priceNode.node.click();
    sleep(500);
} else {
    log("未找到目标票档，尝试坐标兜底");
    fallbackClick();
    sleep(500);
}

// ---------- Step 5: 点击"确定/下一步"进入订单确认页 ----------
log("点击确定/下一步...");
for (var retry = 0; retry < 3; retry++) {
    var nextBtn = findByKeywords(NextStepKeywords, 1500);
    if (nextBtn) {
        log("点击: " + nextBtn.text);
        nextBtn.node.click();
        sleep(600);
    } else {
        fallbackClick();
        sleep(600);
    }
}

// ---------- Step 6: 选择观演人 ----------
log("选择观演人...");
sleep(800);
var matchedViewers = 0;
for (var vi = 0; vi < TargetViewers.length; vi++) {
    var viewerName = TargetViewers[vi];
    var vNode = text(viewerName).findOne(1500);
    if (vNode) {
        log("勾选观演人: " + viewerName);
        // 观演人姓名旁边的复选框
        vNode.click();
        matchedViewers++;
        sleep(200);
    } else {
        log("未找到观演人: " + viewerName + " （请确认 APP 里已添加）");
    }
}
log("已匹配 " + matchedViewers + "/" + TargetViewers.length + " 位观演人");

// 点"确定"完成选观演人
sleep(500);
var viewerConfirm = findByKeywords(["确定", "确认"], 1500);
if (viewerConfirm) {
    viewerConfirm.node.click();
    sleep(800);
}

// ---------- Step 7: 提交订单 ----------
if (isDebug) {
    log("========== 调试模式：跳过提交订单 ==========");
    toast("【调试完成】已走到提交订单前\n关闭 isDebug 即可正式抢票");
    device.vibrate(1500);
    exit();
}

log("提交订单...");
var submitBtn = findByKeywords(SubmitOrderKeywords, 3000);
if (submitBtn) {
    log("点击: " + submitBtn.text);
    submitBtn.node.click();
} else {
    log("未找到提交按钮，尝试兜底");
    fallbackClick();
}

// ---------- Step 8: 提醒付款 ----------
sleep(1000);
log("============================================");
log("已进入支付页！请立即完成付款！");
log("============================================");
toast("已抢到订单！请立即付款（15 分钟内）");
device.vibrate(3000);

// 循环震动 + toast 提醒 3 次（避免你没看到）
for (var n = 0; n < 3; n++) {
    sleep(2000);
    toast("订单倒计时！请付款！");
    device.vibrate(2000);
}

log("脚本结束。剩下的支付请手动完成。");
