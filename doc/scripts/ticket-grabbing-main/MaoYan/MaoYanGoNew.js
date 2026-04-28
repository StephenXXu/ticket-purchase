// 检查无障碍服务是否已经启用，如果没有启用则跳转到无障碍服务启用界面，并等待无障碍服务启动；当无障碍服务启动后脚本会继续运行。
auto.waitFor();
//打开猫眼app
app.launchApp("猫眼");
openConsole();
console.setTitle("猫眼 go!", "#ff11ee00", 30);

//确认选票坐标，建议配置（不配置时仍会寻找“确认”按钮进行点击，但可能会出现点击失败的情况）
const ConfirmX = 878;
const ConfirmY = 2263;

//是否在测试调试
var isDebug = false;
//调试模式下的模拟票档自动选择的点击坐标
const debugTicketClickX = 207;
const debugTicketClickY = 1170;

main();

function main() {
    console.log("开始猫眼抢票!");
    var preBook = text("已 预 约").findOne(2000);
    var preBook2 = className("android.widget.TextView").text("已填写").findOne(2000);
    var isPreBook = preBook2 != null || preBook != null;
    console.log("界面是否已预约：" + isPreBook);
    if (!isPreBook && !isDebug) {
        console.log("无预约信息，请提前填写抢票信息!（若已经开票，请到票档界面使用MoYanMonitor.js）");
        return;
    }

    //出现刷新按钮时点击刷新
    threads.start(function () {
        log('刷新按钮自动点击线程已启动');
        while (true) {
            textContains("刷新").waitFor();
            textContains("刷新").findOne().click();
            log("点击刷新...");
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
    console.log("①准备确认购票");

    //猛点，一直点到出现支付按钮为止
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
        if (className("android.widget.Button").exists()) {
            break;
        }
        if (cnt % 20 == 0) {
            log("已点击确认次数：" + cnt);
        }
    }
    console.log("②进入支付页面处理");

    if (isDebug) {
        console.log("调试模式，不点击支付按钮");
    } else {
        handlePaymentPage();
    }

    console.log("结束");

}

// 支付页面处理：精确点击 + 库存检测 + 超时退出，让微信指纹/支付宝免密接管
// 旧逻辑用 className('android.widget.Button') 盲点 50ms 间隔，会点到任意按钮（如返回/取消），
// 且无库存检测；520 次点击 ≈ 26 秒，远超热门票库存预留窗口（5–10 秒），订单必然回库。
function handlePaymentPage() {
    var PAY_BUTTON_TEXTS = ["立即支付", "确认支付", "去支付"];
    var STOCK_OUT_KEYWORDS = ["库存不足", "已售罄", "票已售完", "已售完", "暂无余票", "无票"];
    var PAY_TIMEOUT_MS = 5000;   // 支付页处理总时长上限
    var PAY_CLICK_MAX = 2;       // 支付按钮最多点 2 次（一次成功，一次容错）

    var deadline = Date.now() + PAY_TIMEOUT_MS;
    var payClickCount = 0;
    var cashierReached = false;

    while (Date.now() < deadline && payClickCount < PAY_CLICK_MAX) {
        // 1. 库存不足检测：立即退出，避免对失效订单重复点击
        for (var i = 0; i < STOCK_OUT_KEYWORDS.length; i++) {
            var kw = STOCK_OUT_KEYWORDS[i];
            if (textContains(kw).exists() || descContains(kw).exists()) {
                console.log("✗ 检测到「" + kw + "」，订单已失效，立即退出");
                return;
            }
        }

        // 2. 检测是否已跳到微信/支付宝收银台 → 让脚本退场，由免密/指纹接管
        if (textContains("微信支付").exists() || descContains("微信支付").exists() ||
            textContains("支付宝").exists() || descContains("支付宝").exists()) {
            cashierReached = true;
            break;
        }

        // 3. 精确查找支付按钮（避免点到返回/取消等其他 Button）
        var payBtn = null;
        for (var j = 0; j < PAY_BUTTON_TEXTS.length; j++) {
            payBtn = text(PAY_BUTTON_TEXTS[j]).findOne(300);
            if (payBtn) break;
        }

        if (payBtn) {
            payBtn.click();
            payClickCount++;
            log("✓ 点击「" + payBtn.text() + "」(第 " + payClickCount + " 次)");
            sleep(800);   // 给页面跳转时间，不要 50ms 盲点
        } else {
            sleep(200);
        }
    }

    if (cashierReached) {
        console.log("✓ 已进入收银台，请在微信指纹 / 支付宝免密 完成支付");
        device.vibrate([200, 100, 200, 100, 200]);
    } else {
        console.log("✗ 未能进入收银台（超时或库存不足），订单将在 15 分钟内回库");
    }
}
