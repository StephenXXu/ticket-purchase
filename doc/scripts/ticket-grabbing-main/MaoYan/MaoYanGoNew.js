// === 全局开关：测试时 true（开浮动 console + Timer 日志），抢票时改 false（关二者，省 UI 线程开销）===
var TIMER_ENABLED = true;

// 检查无障碍服务是否已经启用，如果没有启用则跳转到无障碍服务启用界面，并等待无障碍服务启动；当无障碍服务启动后脚本会继续运行。
auto.waitFor();
//打开猫眼app
app.launchApp("猫眼");
if (TIMER_ENABLED) {
    openConsole();
    console.setTitle("猫眼 go!", "#ff11ee00", 30);
}

//确认选票坐标，建议配置（不配置时仍会寻找“确认”按钮进行点击，但可能会出现点击失败的情况）
const ConfirmX = 602;
const ConfirmY = 2241;

//是否在测试调试
var isDebug = false;
//调试模式下的模拟票档自动选择的点击坐标
const debugTicketClickX = 207;
const debugTicketClickY = 1170;

// === 阶段耗时监控（轻量自闭包，不依赖外部库）===
// 用法：Timer.start() 开计时；Timer.mark("xxx") 在每个关键节点打点；Timer.summary() 末尾打印总览。
// 输出示例：
//   ⏱ [+1234ms / 累计 1234ms] 已预约检测完成
//   ⏱ [+856ms / 累计 2090ms] 开抢按钮已出现并点击
//   ════════ 阶段耗时汇总 ════════
//     +1234ms  →  已预约检测完成
//     +856ms   →  开抢按钮已出现并点击
//     ...
//     总耗时: Xms
var Timer = (function () {
    var marks = [], startTs = 0;
    return {
        start: function () {
            startTs = Date.now(); marks = [];
            if (TIMER_ENABLED) log("⏱ Timer 启动");
        },
        mark: function (label) {
            if (!TIMER_ENABLED) return;
            var now = Date.now();
            var sinceStart = now - startTs;
            var sinceLast = marks.length > 0 ? now - marks[marks.length - 1].ts : sinceStart;
            marks.push({ label: label, sinceStart: sinceStart, sinceLast: sinceLast, ts: now });
            log("⏱ [+" + sinceLast + "ms / 累计 " + sinceStart + "ms] " + label);
        },
        summary: function () {
            if (!TIMER_ENABLED) return;
            log("════════ 阶段耗时汇总 ════════");
            for (var i = 0; i < marks.length; i++) {
                var m = marks[i];
                log("  +" + m.sinceLast + "ms  →  " + m.label);
            }
            if (marks.length > 0) {
                log("  ─────────────────────");
                log("  总耗时: " + marks[marks.length - 1].sinceStart + "ms");
            }
            log("══════════════════════════════");
        }
    };
})();

Timer.start();
main();

function main() {
    console.log("开始猫眼抢票!");
    var preBook = text("已 预 约").findOne(2000);
    var preBook2 = className("android.widget.TextView").text("已填写").findOne(2000);
    var isPreBook = preBook2 != null || preBook != null;
    console.log("界面是否已预约：" + isPreBook);
    Timer.mark("已预约检测完成 (isPreBook=" + isPreBook + ")");
    if (!isPreBook && !isDebug) {
        console.log("无预约信息，请提前填写抢票信息!（若已经开票，请到票档界面使用MoYanMonitor.js）");
        Timer.summary();
        return;
    }

    //出现刷新按钮时点击刷新（彻底静默：包名过滤 + 真坐标点击 + 无 log，避免污染日志）
    threads.start(function () {
        while (true) {
            textContains("刷新").packageName(MAOYAN_PKG).waitFor();
            var refreshNode = textContains("刷新").packageName(MAOYAN_PKG).findOne();
            tryClick(refreshNode);
            sleep(100);
        }
    });

    console.log("等待开抢...");
    // packageName 过滤防止 console 浮窗内同名文字被误命中
    var GRAB_TEXTS = ["立即预订", "立即购票", "特惠购票"];
    while (true) {
        var grabNode = null;
        for (var gi = 0; gi < GRAB_TEXTS.length; gi++) {
            grabNode = text(GRAB_TEXTS[gi]).packageName(MAOYAN_PKG).findOne(30);
            if (grabNode) break;
        }
        if (grabNode) {
            tryClick(grabNode);
            break;
        }
        sleep(30);
    }
    Timer.mark("开抢按钮已出现并点击");
    console.log("①准备确认购票");

    // ①确认购票：packageName 隔离 console 污染 + bounds 真点击 + 文字检测退出 + 硬上限
    // 旧逻辑 click(ConfirmX, ConfirmY) 固定坐标 + accessibility click 对猫眼自定义 View 几乎无效；
    // 退出条件 className('Button').exists() 在新版猫眼极少为 true，导致循环失控（实测点了 1158823 次仍不退出）。
    var CONFIRM_TEXTS = ["确认", "立即购买", "立即下单", "提交订单"];
    var EXIT_TO_PAY_TEXTS = ["立即支付", "确认支付", "去支付", "支付订单"];
    var CONFIRM_MAX = 30;
    var confirmClickCount = 0;
    var paidPageReached = false;
    for (var cnt = 0; cnt < CONFIRM_MAX; cnt++) {
        // 1. 已到支付页 → 提前退出
        var atPay = false;
        for (var i = 0; i < EXIT_TO_PAY_TEXTS.length; i++) {
            if (text(EXIT_TO_PAY_TEXTS[i]).packageName(MAOYAN_PKG).exists()) { atPay = true; break; }
        }
        if (atPay) { paidPageReached = true; break; }

        // 2. 找确认类按钮（包名限定）→ tryClick（取 bounds 中心做真·屏幕点击）
        var confirmNode = null;
        for (var j = 0; j < CONFIRM_TEXTS.length; j++) {
            confirmNode = text(CONFIRM_TEXTS[j]).packageName(MAOYAN_PKG).findOne(150);
            if (confirmNode) break;
        }
        if (confirmNode && tryClick(confirmNode)) {
            confirmClickCount++;
        }
        sleep(200);
    }
    Timer.mark("①确认购票完成 (点击 " + confirmClickCount + " 次, 已到支付页=" + paidPageReached + ")");
    console.log("②进入支付页面处理");

    if (isDebug) {
        console.log("调试模式，不点击支付按钮");
    } else {
        handlePaymentPage();
    }
    Timer.mark("②支付页处理结束");

    console.log("结束");
    Timer.summary();
}

// 包名常量：所有 selector 必须 .packageName(MAOYAN_PKG)，否则会被 AutoX 浮动 console 污染
var MAOYAN_PKG = "com.sankuai.movie";
var PAY_PKG_WECHAT = "com.tencent.mm";
var PAY_PKG_ALIPAY = "com.eg.android.AlipayGphone";

// 真·屏幕点击：取节点 bounds 中心坐标做 click()，绕过 AutoX accessibility action 对自定义 View（React Native/Compose/自绘）经常无响应的问题
// 静默实现（不打 log），避免污染日志；返回 true=点击成功，false=节点无效
function tryClick(node) {
    if (!node) return false;
    var b = node.bounds();
    if (b && b.width() > 0 && b.height() > 0) {
        click(b.centerX(), b.centerY());
        return true;
    }
    // bounds 无效时兜底用 accessibility click（多半也不行，但好过完全不点）
    try { node.click(); return true; } catch (e) { return false; }
}

// 支付页面处理：包名级收银台检测 + packageName 过滤 + bounds 真点击 + 失败时 dump 诊断
// 设计要点：
// 1. 用 currentPackage() 判断是否真的跳到外部微信/支付宝；只看页面文字会被 in-app 支付方式 sheet 误判
// 2. 所有 selector 加 .packageName(MAOYAN_PKG) 过滤，杜绝 console 浮窗污染
// 3. 两步支付兼容：「立即支付」→ 弹支付方式 sheet → 还要再点「确认支付」一次，故 PAY_CLICK_MAX=6
// 4. 失败时 dumpVisibleButtons 打印可点击元素，方便定位真实按钮文字
function handlePaymentPage() {
    var PAY_BUTTON_TEXTS = ["立即支付", "确认支付", "去支付", "提交订单", "立即下单"];
    var STOCK_OUT_KEYWORDS = ["库存不足", "已售罄", "票已售完", "已售完", "暂无余票", "无票"];
    var CANCEL_KEYWORDS = ["取消", "返回", "放弃", "稍后", "再想想", "关闭"];
    var PAY_TIMEOUT_MS = 8000;   // 含两步支付，放宽到 8 秒
    var PAY_CLICK_MAX = 6;

    var deadline = Date.now() + PAY_TIMEOUT_MS;
    var payClickCount = 0;
    var firstClickMarked = false;

    while (Date.now() < deadline && payClickCount < PAY_CLICK_MAX) {
        // 1. 库存检测（包名过滤，避免误命中 console 里的关键词）
        for (var i = 0; i < STOCK_OUT_KEYWORDS.length; i++) {
            var kw = STOCK_OUT_KEYWORDS[i];
            if (textContains(kw).packageName(MAOYAN_PKG).exists() ||
                descContains(kw).packageName(MAOYAN_PKG).exists()) {
                console.log("✗ 检测到「" + kw + "」，订单已失效");
                Timer.mark("支付页·库存不足退出 (" + kw + ")");
                return;
            }
        }

        // 2. 真·收银台检测：包名跳到微信/支付宝才算
        var pkg = currentPackage();
        if (pkg === PAY_PKG_WECHAT || pkg === PAY_PKG_ALIPAY) {
            console.log("✓ 已跳到外部收银台 (" + pkg + ")，由指纹/免密接管");
            Timer.mark("支付页·进入收银台 " + pkg + " (点击 " + payClickCount + " 次)");
            device.vibrate([200, 100, 200, 100, 200]);
            return;
        }

        // 3. 三级按钮查找 + cancel 过滤 + 真点击
        var payBtn = findPayButton(PAY_BUTTON_TEXTS, CANCEL_KEYWORDS);
        if (payBtn) {
            var btnLabel = payBtn.text() || payBtn.desc() || "[Button]";
            if (tryClick(payBtn)) {
                payClickCount++;
                if (!firstClickMarked) {
                    Timer.mark("支付页·首次点击「" + btnLabel + "」");
                    firstClickMarked = true;
                }
            }
            sleep(800);
        } else {
            sleep(200);
        }
    }

    // 走到这里 = 超时或点满，未进收银台 → 打印诊断信息
    console.log("✗ 未能进入外部收银台 (点击 " + payClickCount + " 次)");
    Timer.mark("支付页·超时退出 (点击 " + payClickCount + " 次)");
    dumpVisibleButtons();
}

// 三级 cascade 查找支付按钮（全部 packageName 过滤）
function findPayButton(positiveTexts, cancelKeywords) {
    // Level 1：精确文本
    for (var i = 0; i < positiveTexts.length; i++) {
        var b = text(positiveTexts[i]).packageName(MAOYAN_PKG).findOne(150);
        if (b) return b;
    }
    // Level 2：含「支付」二字 + 排除 cancel
    var fuzzy = textContains("支付").packageName(MAOYAN_PKG).find();
    if (fuzzy && fuzzy.size() > 0) {
        for (var j = 0; j < fuzzy.size(); j++) {
            var c = fuzzy.get(j);
            var t = c.text() || "";
            if (containsAny(t, cancelKeywords)) continue;
            return c;
        }
    }
    // Level 3：className 兜底（原版思路）+ cancel 过滤
    var allBtns = className("android.widget.Button").packageName(MAOYAN_PKG).find();
    if (allBtns && allBtns.size() > 0) {
        for (var m = 0; m < allBtns.size(); m++) {
            var b2 = allBtns.get(m);
            var t2 = b2.text() || "";
            if (containsAny(t2, cancelKeywords)) continue;
            return b2;
        }
    }
    return null;
}

function containsAny(str, keywords) {
    if (!str) return false;
    for (var i = 0; i < keywords.length; i++) {
        if (str.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
}

// 失败时打印猫眼包内所有 Button + 含「支付」字样的元素（packageName 过滤后输出更干净）
function dumpVisibleButtons() {
    log("─── 诊断·当前包名: " + currentPackage() + " ───");
    log("─── 含「支付」字样的元素 (猫眼包内) ───");
    var withPay = textContains("支付").packageName(MAOYAN_PKG).find();
    if (withPay && withPay.size() > 0) {
        for (var i = 0; i < withPay.size(); i++) {
            var e = withPay.get(i);
            log("  • text=「" + (e.text() || "") + "」 desc=「" + (e.desc() || "") + "」 class=" + e.className() + " clickable=" + e.clickable());
        }
    } else {
        log("  (无)");
    }
    log("─── 所有 Button (猫眼包内) ───");
    var btns = className("android.widget.Button").packageName(MAOYAN_PKG).find();
    if (btns && btns.size() > 0) {
        for (var k = 0; k < btns.size(); k++) {
            var b = btns.get(k);
            log("  • text=「" + (b.text() || "") + "」 desc=「" + (b.desc() || "") + "」");
        }
    } else {
        log("  (无)");
    }
    log("──────────────────────");
}
