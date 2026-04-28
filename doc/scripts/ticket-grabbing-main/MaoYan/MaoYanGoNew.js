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

    //出现刷新按钮时点击刷新（不再每次打 log，只在首次 + 每 30 次触发 Timer.mark 留痕）
    threads.start(function () {
        log('刷新按钮自动点击线程已启动');
        var refreshCount = 0;
        while (true) {
            textContains("刷新").waitFor();
            textContains("刷新").findOne().click();
            refreshCount++;
            if (refreshCount === 1) {
                Timer.mark("刷新线程·首次点击");
            } else if (refreshCount % 30 === 0) {
                Timer.mark("刷新线程·已点击 " + refreshCount + " 次");
            }
            //避免点击过快
            sleep(100);
        }
    });

    console.log("等待开抢...");
    while (true) {
        var but1 = classNameStartsWith('android.widget.').text("立即预订").exists();
        var but2 = classNameStartsWith('android.widget.').text("立即购票").exists();
        var but3 = classNameStartsWith('android.widget.').text("特惠购票").exists();
        //var but4= classNameStartsWith('android.widget.').text("缺货登记").exists();
        var result = but1 || but2 || but3;
        if (result) {
            var s;
            if (but1) {
                var s = classNameStartsWith('android.widget.').text("立即预订").findOne().click();
            } else if (but2) {
                var s = classNameStartsWith('android.widget.').text("立即购票").findOne().click();
            } else if (but3) {
                var s = classNameStartsWith('android.widget.').text("特惠购票").findOne().click();
            }
            break;
        }
    }
    Timer.mark("开抢按钮已出现并点击");
    console.log("①准备确认购票");

    //猛点，一直点到出现支付按钮为止
    var confirmClickCount = 0;
    for (let cnt = 0; cnt >= 0; cnt++) {
        if (isDebug) {
            //调试模式，模拟选择票档，模拟已预约后自动选择票档
            click(debugTicketClickX, debugTicketClickY);
        }

        //绝对坐标点击
        click(ConfirmX, ConfirmY);
        //文字查找按钮点击，避免未正确配置坐标导致的点击失败
        if (text("确认").exists()) {
            text("确认").click();
        }
        sleep(50);
        confirmClickCount++;
        if (className("android.widget.Button").exists()) {
            break;
        }
        if (cnt % 20 == 0) {
            log("已点击确认次数：" + cnt);
        }
    }
    Timer.mark("①确认购票完成 (共点击 " + confirmClickCount + " 次)");
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

// 支付页面处理：三段式按钮查找 + 包名级收银台检测 + 失败时 dump 诊断
// 设计要点：
// 1. 用 currentPackage() 判断是否真的跳到外部微信/支付宝；只看页面文字会被 in-app 支付方式 sheet 误判
// 2. 按钮查找三级 cascade：精确 text → textContains("支付") → className 兜底，全部排除取消/返回
// 3. 两步支付兼容：「立即支付」→ 弹支付方式 sheet → 还要再点「确认支付」一次，故 PAY_CLICK_MAX=6
// 4. 失败时 dumpVisibleButtons 打印可点击元素，方便下次定位真正的按钮文字
var PAY_PKG_WECHAT = "com.tencent.mm";
var PAY_PKG_ALIPAY = "com.eg.android.AlipayGphone";

function handlePaymentPage() {
    var PAY_BUTTON_TEXTS = ["立即支付", "确认支付", "去支付", "提交订单", "立即下单"];
    var STOCK_OUT_KEYWORDS = ["库存不足", "已售罄", "票已售完", "已售完", "暂无余票", "无票"];
    var CANCEL_KEYWORDS = ["取消", "返回", "放弃", "稍后", "再想想", "不", "关闭"];
    var PAY_TIMEOUT_MS = 8000;   // 含两步支付，放宽到 8 秒
    var PAY_CLICK_MAX = 6;

    var deadline = Date.now() + PAY_TIMEOUT_MS;
    var payClickCount = 0;
    var firstClickMarked = false;

    while (Date.now() < deadline && payClickCount < PAY_CLICK_MAX) {
        // 1. 库存检测
        for (var i = 0; i < STOCK_OUT_KEYWORDS.length; i++) {
            var kw = STOCK_OUT_KEYWORDS[i];
            if (textContains(kw).exists() || descContains(kw).exists()) {
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

        // 3. 三级按钮查找 + cancel 过滤
        var payBtn = findPayButton(PAY_BUTTON_TEXTS, CANCEL_KEYWORDS);
        if (payBtn) {
            var btnLabel = payBtn.text() || payBtn.desc() || "[Button]";
            payBtn.click();
            payClickCount++;
            log("✓ 点击「" + btnLabel + "」(第 " + payClickCount + " 次)");
            if (!firstClickMarked) {
                Timer.mark("支付页·首次点击「" + btnLabel + "」");
                firstClickMarked = true;
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

// 三级 cascade 查找支付按钮
function findPayButton(positiveTexts, cancelKeywords) {
    // Level 1：精确文本
    for (var i = 0; i < positiveTexts.length; i++) {
        var b = text(positiveTexts[i]).findOne(150);
        if (b) return b;
    }
    // Level 2：含「支付」二字 + 排除 cancel
    var fuzzy = textContains("支付").find();
    if (fuzzy && fuzzy.size() > 0) {
        for (var j = 0; j < fuzzy.size(); j++) {
            var c = fuzzy.get(j);
            var t = c.text() || "";
            if (containsAny(t, cancelKeywords)) continue;
            return c;
        }
    }
    // Level 3：className 兜底（原版思路）+ cancel 过滤
    var allBtns = className("android.widget.Button").find();
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

// 失败时打印当前页面所有可点击元素 + 含「支付」字样的元素，下次卡住直接看 log 就能定位
function dumpVisibleButtons() {
    log("─── 诊断·当前包名: " + currentPackage() + " ───");
    log("─── 含「支付」字样的元素 ───");
    var withPay = textContains("支付").find();
    if (withPay && withPay.size() > 0) {
        for (var i = 0; i < withPay.size(); i++) {
            var e = withPay.get(i);
            log("  • text=「" + (e.text() || "") + "」 desc=「" + (e.desc() || "") + "」 class=" + e.className() + " clickable=" + e.clickable());
        }
    } else {
        log("  (无)");
    }
    log("─── 所有 Button ───");
    var btns = className("android.widget.Button").find();
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
