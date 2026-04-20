# 大麦抢票操作手册（WECENG + Guyungy 双工具）

> 覆盖工具：
> - `Guyungy/damaihelper`（Windows GUI · 开箱即用）
> - `WECENG/ticket-purchase`（Python + Selenium + Appium · 跨平台 · 双端）
>
> 目标平台：大麦网 / 淘票票 / 缤玩岛
>
> 编写日期：2026-04-19

---

## 1. 两个工具怎么选

| 维度 | Guyungy/damaihelper | WECENG/ticket-purchase |
|---|---|---|
| **运行系统** | 仅 Windows 10/11 | Windows / Mac / Linux |
| **交互方式** | 图形化 GUI，鼠标点选 | 命令行 + JSON 配置 |
| **上手难度** | ⭐ 5 分钟能跑 | ⭐⭐⭐ 要装 Python/Node |
| **覆盖平台** | 大麦 / 淘票票 / 缤玩岛 | 仅大麦（PC + 安卓双端） |
| **验证码** | 内置 OCR 自动识别 | 需要手动介入 |
| **Star / 活跃度** | 3.0k ⭐ / 2026-03 活跃 | 6.3k ⭐ / 2026-02 活跃 |
| **适合人群** | 非程序员、Windows 用户 | 有开发能力、想要 Appium |

**推荐路径**：
- Windows 用户 → **先 Guyungy，再加 WECENG 作为双保险**
- Mac/Linux 用户 → **只能用 WECENG**（或装 Windows 虚拟机跑 Guyungy）

---

## 2. Guyungy/damaihelper 完整操作

### 2.1 环境准备（Windows）

```
① 装 Python 3.8 或更高（官网下，安装时勾选"Add to PATH"）
② 装 Chrome 浏览器（最新稳定版）
③ 克隆或下载项目：
    git clone https://github.com/Guyungy/damaihelper
    # 或网页点 Code → Download ZIP，解压到任意目录
④ 打开 cmd 或 PowerShell，cd 到项目目录
⑤ 安装依赖：
    pip install -r requirements.txt
```

### 2.2 ChromeDriver 版本匹配（最常见坑）

```
① 打开 Chrome → 右上角三个点 → 帮助 → 关于 Google Chrome
② 记下主版本号（如 131.0.6778.x）
③ 访问：https://googlechromelabs.github.io/chrome-for-testing/
④ 找到对应主版本号（131.x）的 chromedriver，下载 win64 版
⑤ 解压出 chromedriver.exe
⑥ 替换项目根目录的 chromedriver.exe（同名覆盖）
```

**ChromeDriver 和 Chrome 主版本号必须一致**，大版本差 1 都不行。

### 2.3 启动

**方式 A：一键启动（推荐）**
```
双击项目根目录的  win一件运行.bat
```
（是"件"不是"键"，作者原命名）

**方式 B：命令行**
```
cd damaihelper
python GUI.py
```

启动后弹出图形化窗口。

### 2.4 GUI 操作流程

```
【第 1 步】选择平台
    └── 下拉选：大麦网 / 淘票票 / 缤玩岛

【第 2 步】扫码登录
    └── 点"登录"按钮
    └── 弹出 Chrome 窗口，显示大麦扫码页
    └── 打开大麦手机 APP → 扫码
    └── 登录成功后 Cookie 自动保存到 config/cookies.json
    └── 下次启动免扫码

【第 3 步】粘贴演出 URL
    从 https://www.damai.cn/ 搜索目标演唱会
    进入演出详情页，复制地址栏完整 URL
    粘贴到 GUI 的"演出链接"输入框
    例：https://detail.damai.cn/item.htm?id=xxx...

【第 4 步】勾选抢票参数
    ├── 场次日期（从下拉框选，如 2026-05-05）
    ├── 票档价位（如 680 元档）
    ├── 观演人（勾选账号里已添加的观演人姓名）
    ├── 购票数量（默认 1 张）
    └── 刷新频率（默认 500ms，不用改）

【第 5 步】选抢票模式
    ○ 卡点抢票（定时启动，用于开售瞬间）
    ○ 余票监控（挂机持续刷新，用于回流捡漏）

【第 6 步】点"开始抢票"
    └── Chrome 自动打开 → 跳转演出页 → 开始执行
    └── 遇到验证码 → 内置 OCR 自动识别并填入
    └── 日志实时显示在 GUI 下半部分
```

### 2.5 观演人预置（必做）

```
① 打开大麦 APP（手机）
② 我的 → 常用观演人 → 添加
③ 填身份证姓名（和 Guyungy 里的观演人字符串必须完全一致）
④ 大麦演唱会强实名，一旦抢到绑定此观演人，不能改
```

### 2.6 常见问题

| 症状 | 处理 |
|---|---|
| `session not created: ChromeDriver only supports version X` | 重下载匹配 ChromeDriver |
| GUI 启动闪退 | `pip install -r requirements.txt` 重装依赖 |
| 扫码后 Cookie 未保存 | 删 `config/cookies.json` 重扫 |
| 验证码 OCR 识别错 | 手动在浏览器里输入，脚本会继续 |
| "CREATE_PROCESS failed" | 任务管理器杀所有 Chrome 进程后重试 |
| 找不到观演人选项 | 先去大麦 APP 添加观演人，再回来点刷新 |

---

## 3. WECENG/ticket-purchase 完整操作

### 3.1 环境准备（Mac / Linux / Windows）

```bash
# 基础依赖
Python 3.9+
Node.js 20.19.0+        # 仅 Appium 端需要
Chrome 浏览器            # 仅 PC 端需要

# 克隆项目
git clone https://github.com/WECENG/ticket-purchase
cd ticket-purchase

# 环境自检（作者提供）
bash check_environment.sh

# 装依赖（作者用 Poetry 管理）
pip install poetry
poetry install
poetry shell            # 进入虚拟环境
```

### 3.2 选用 PC 端 还是 Appium 端

| 对比 | PC 端（damai/） | Appium 端（damai_appium/） |
|---|---|---|
| 登录方式 | Chrome 扫码 | 手机 APP 扫码 |
| 操作对象 | 浏览器 | 安卓 APP |
| 风控 | 中（Selenium 特征） | 低（真机操作） |
| 配置复杂度 | 低 | 高（需装 Appium、ADB） |
| 成功率 | 普通 | 较高 |

**热门演出推荐 Appium 端**（大麦 PC 已削弱，APP 是主战场）。

### 3.3 PC 端配置 `damai/config.json`

```json
{
  "index_url":  "https://www.damai.cn/",
  "login_url":  "https://passport.damai.cn/login?ru=https%3A%2F%2Fwww.damai.cn%2F",
  "target_url": "https://detail.damai.cn/item.htm?id=演出ID...",
  "users":      ["观演人a", "观演人b"],
  "city":       "杭州",
  "dates":      ["2026-05-05"],
  "prices":     ["680"],
  "if_listen":  true,
  "if_commit_order": false,
  "max_retries": 10000
}
```

**字段详解**：

| 字段 | 含义 | 注意 |
|---|---|---|
| `index_url` | 大麦主页 URL | 不用改 |
| `login_url` | 扫码登录页 URL | 不用改 |
| `target_url` | 演出详情页完整 URL | 从大麦网复制粘贴 |
| `users` | 观演人姓名数组 | 必须和大麦账号里完全一致 |
| `city` | 演出城市 | 和大麦显示一致 |
| `dates` | 场次日期数组 | **yyyy-MM-dd 格式**（和猫眼 MM-dd 不同！） |
| `prices` | 票价数组 | 字符串，精确匹配（680 不等于 680 元） |
| `if_listen` | 是否挂机监听余票 | `true` = 回流模式 |
| `if_commit_order` | 是否自动提交订单 | **建议先 `false` 手动确认**，熟练后改 `true` |
| `max_retries` | 最大重试次数 | `10000` 够用 |

### 3.4 PC 端启动

```bash
# 方式 A：快捷脚本（作者提供）
bash start_ticket_grabbing.sh

# 方式 B：手动
cd damai
python main.py       # 或按 README 指定入口
```

### 3.5 PC 端运行流程

```
1. 脚本启动 → 打开 Chrome → 跳到登录页
2. 扫码登录（大麦 APP 扫）
3. 自动跳转到 target_url 演出详情页
4. 监听到"可购买"状态 → 执行：
   选城市 → 选日期 → 选票档 → 选观演人 → 进确认订单页
5. if_commit_order=false：停在确认页等你支付
   if_commit_order=true：自动点"提交订单"
6. 付款页显示 → 手机支付宝免密支付完成
```

### 3.6 Appium 端配置 `damai_appium/config.jsonc`

```jsonc
{
  // Appium 服务地址
  "appium_server_url": "http://localhost:4723",

  // 目标 APP
  "app_package": "cn.damai",
  "app_activity": "cn.damai.launcher.splash.SplashMainActivity",

  // 搜索关键词（代替 target_url）
  "keyword": "欢子 杭州",

  // 抢票参数（含义同 PC 端）
  "users": ["观演人a", "观演人b"],
  "city": "杭州",
  "dates": ["2026-05-05"],
  "price_desc": "680元",    // APP 显示的票价文字
  "price_index": 1,         // 票档序号（从 0 起）
  "if_commit_order": false
}
```

### 3.7 Appium 端准备（安卓设备）

```bash
# 安装 Appium
npm install -g appium
appium driver install uiautomator2

# 环境变量（Mac/Linux）
export ANDROID_HOME=~/Library/Android/sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Windows 在系统环境变量里设置同样的内容

# 手机准备
# ① 设置 → 关于手机 → 连点"版本号"7 次开启开发者选项
# ② 开发者选项 → 打开"USB 调试"
# ③ 数据线连电脑 → 手机弹窗允许 USB 调试

# 验证设备已连接
adb devices
# 应显示: xxxxxxxx  device
```

### 3.8 Appium 端启动

```bash
# 终端 1：启动 Appium 服务
bash start_appium.sh

# 终端 2：跑抢票脚本
cd damai_appium
python main.py
```

### 3.9 常见问题

| 症状 | 处理 |
|---|---|
| `adb devices` 显示空 | 开发者选项 + USB 调试 + 授权电脑 |
| `Appium server not reachable` | 先跑 `start_appium.sh`，确认 4723 端口监听中 |
| `No uiautomator2 driver` | `appium driver install uiautomator2` |
| ChromeDriver 版本不匹配 | 同 Guyungy 处理方法 |
| 元素定位失败 | 用 Appium Inspector 重抓 xpath（大麦改版频繁） |
| 登录态丢失 | 删 `cookies/` 目录重新扫码 |
| `max_retries` 用完 | 调大；但更可能是接口已失效 |

---

## 4. 双工具联动策略

### 4.1 单演出 · 双保险策略

```
【目标】抢 2026-05-05 某演唱会 680 元票档，2 位观演人

【设备】
  ├── Windows PC：跑 Guyungy GUI（账号 A）
  └── Mac + 安卓手机：跑 WECENG Appium（账号 B）

【开售前 24h】
  ✓ 两台设备都扫码登录完成
  ✓ 两个账号都在大麦 APP 里加了观演人
  ✓ Guyungy 配置参数 + 跑冷门场次测试
  ✓ WECENG config.json 填好 + bash check_environment.sh
  ✓ 支付宝免密支付两个账号都开通

【开售 T=0】
  ✓ Guyungy GUI 选"卡点抢票"，点"开始"
  ✓ WECENG Appium 终端运行 python main.py
  ✓ 两个设备同时启动
  ✓ 任意一台先进订单页 → 手动 / 免密支付

【T+10min】
  ✓ 没抢到 → 两边都切换到"余票监控"模式
    Guyungy：GUI 选"余票监控"重启
    WECENG：改 if_listen=true 重启
  ✓ 挂机 24-72h 等回流
```

### 4.2 多演出 · 分工策略

```
演出 A（5-05 杭州）→ Guyungy + 账号 A
演出 B（5-12 上海）→ WECENG + 账号 B

各用各的账号各自抢，不冲突
```

---

## 5. 开售时间线（T 为开售时刻）

### 5.1 T-72h（提前 3 天）
```
✓ 两个账号完成实名认证
✓ 每个账号添加目标观演人（姓名精确一致）
✓ 每个账号绑定默认收货地址
✓ 每个账号开通支付宝小额免密支付
✓ 克隆并配置 Guyungy（Windows）或 WECENG（Mac）
✓ 用任意已开售的冷门演出跑一遍完整流程（不用付款，能到确认页即可）
```

### 5.2 T-24h（开售前一天）
```
✓ 填最终配置（target_url、dates、prices、users）
✓ 测试 Chrome 能正常扫码登录
✓ 测试 webhook 能收到通知（如有）
✓ 测试观演人能被正确匹配
✓ PC/手机剩余电量和网络稳定性
```

### 5.3 T-1h
```
✓ 关闭其他占用网络的软件（视频、下载、游戏）
✓ 两台设备都用不同网络（家宽 + 手机 5G）
✓ NTP 对时：
   Windows：w32tm /resync
   Mac：sudo sntp -sS ntp1.aliyun.com
✓ Guyungy GUI 已停在准备页面，点击就开始
✓ WECENG 终端命令已打好，回车就跑
```

### 5.4 T-30s
```
✓ 两个脚本同时启动
✓ 人工在手机大麦 APP 里也同步点击（三线并行）
```

### 5.5 T=0
```
→ Chrome/APP 自动跳转 → 抢票 → 进订单页
→ 手动或免密支付
```

### 5.6 T+10min ~ T+72h
```
✓ 没抢到 → 切换两边到"余票监听"模式挂机
✓ 等 webhook / 铃声 / 震动通知
```

---

## 6. 风控规避要点

### 6.1 IP 隔离
```
Windows PC → 家宽 WiFi
Mac + 手机 → 手机 5G 共享网络
两条网络线路，避免同 IP 触发关联风控
```

### 6.2 账号策略
```
✓ 每个工具绑一个账号，一个账号一个设备
✓ 账号预热 1 周（每天登录逛 5 分钟，模拟真实用户）
✓ 开售前 2 小时保持登录态，别临时登录
✗ 不要多端同时登录同一账号（会互踢）
✗ 不要用他人身份证账号
```

### 6.3 Selenium 反检测
**Guyungy 已内置指纹伪装**，README 声称"Selenium 隐身模式 + 指纹伪装"。
**WECENG PC 端**若被识别，手动引入 `undetected-chromedriver`：

```python
# 把原来的
from selenium import webdriver
driver = webdriver.Chrome()

# 改为
import undetected_chromedriver as uc
driver = uc.Chrome()
```

### 6.4 行为抖动
- 点击间隔加 50-200ms 随机延时（Guyungy 已做）
- 不要 0 秒完成"选日期→选价→选人→提交"全流程

---

## 7. 付款阶段（脚本不负责）

抢到订单后，**你自己在倒计时内付款**：

| 平台 | 默认倒计时 | 建议完成时间 |
|---|---|---|
| 大麦网 | 15 分钟 | 30 秒内 |
| 大麦 APP | 15 分钟 | 30 秒内 |

**超时订单自动取消**，脚本不会自动补抢。

**免密支付能省 5-10 秒**，热门票这点时间是"成单 vs 取消"的分界。

---

## 8. 避坑清单

### 必做 ✅
- [ ] Guyungy 的 ChromeDriver 和 Chrome 主版本号一致
- [ ] WECENG 运行前 `bash check_environment.sh` 自检
- [ ] 观演人姓名和大麦 APP 里**一字不差**（空格、繁简都要对）
- [ ] 首次用 `if_commit_order: false` 手动确认最后一步
- [ ] 支付宝免密支付开通
- [ ] 账号实名认证完成
- [ ] 开售前演练冷门场次走通全流程

### 禁忌 ❌
- ❌ 用他人身份证账号抢票（实名不符进不去）
- ❌ 同账号多端同时登录（会互踢）
- ❌ 临时修改观演人（大麦实名一旦绑定不能改）
- ❌ 抢到不付款（超时取消，不会自动重试）
- ❌ 公网代理 / 数据中心 IP（易被封）
- ❌ 跑别人 fork 的未审查代码（有账号盗窃风险）

### 现实预期
- 热门场次（五月天、周杰伦）脚本命中率 **< 10%**
- 回流监控命中率 **> 开售瞬间**（退款池刷新）
- 大麦风控持续升级，老代码（2022 年前）几乎全失效
- **脚本不保证抢到，只是提高你的手速上限**

---

## 9. 完整实战示例

**目标**：抢 2026-05-05 杭州某演唱会 680 元档，观演人"高小丽、徐兴院"

### Guyungy 方案（Windows）

```
T-24h：
  ✓ 打开 win一件运行.bat
  ✓ GUI 选"大麦网" → 扫码登录（账号 A）
  ✓ 粘贴演出 URL
  ✓ 勾选：场次 2026-05-05 / 票档 680 / 观演人（高小丽、徐兴院）
  ✓ 模式选"余票监控" → 点抢票 → 看能跑通到"等待有票"状态
  ✓ 停止脚本，改为"卡点抢票"模式，设开售时间 05-04 之后的某场次 10:00
  ✓ （不真启动，只配置好）

T-1h：
  ✓ 插电，关其他 Chrome 窗口
  ✓ GUI 停在"开始抢票"按钮前

T-30s：
  ✓ 点"开始抢票"
  ✓ Chrome 自动打开到演出页

T=0：
  → Chrome 自动选日期、选票档、选观演人、进确认订单页
  → 你立即付款

T+10min：
  （如没抢到）
  ✓ GUI 停止当前任务，切"余票监控"模式重启
  ✓ 挂机 24-72h
```

### WECENG 方案（Mac + 安卓）

```
T-24h 准备 damai_appium/config.jsonc：
{
  "keyword": "欢子 杭州",
  "users": ["高小丽", "徐兴院"],
  "city": "杭州",
  "dates": ["2026-05-05"],
  "price_desc": "680元",
  "price_index": 1,
  "if_commit_order": false
}

T-1h：
  ✓ 手机 USB 连 Mac，adb devices 确认
  ✓ 终端 1：bash start_appium.sh
  ✓ 终端 2：cd damai_appium 待命

T-30s：
  ✓ 终端 2：python main.py
  ✓ Appium 自动启动大麦 APP 开抢

T=0：
  → APP 自动搜演出 → 选日期 → 选票档 → 选观演人 → 进订单
  → if_commit_order=false 停在确认页
  → 你手动点"提交"并付款
```

---

## 10. 下一步

```
① 先装 Guyungy（Windows）或 WECENG（Mac），跑通环境
② 用任意冷门场次演练全流程
③ 填入真实目标（target_url / dates / prices / users）
④ 开售前 1 小时最终检查
⑤ T-30s 双设备并行启动
⑥ T+10min 切回流监控
```

---

## 11. 相关资源

| 资源 | 链接 |
|---|---|
| Guyungy/damaihelper | https://github.com/Guyungy/damaihelper |
| WECENG/ticket-purchase | https://github.com/WECENG/ticket-purchase |
| Chrome for Testing（ChromeDriver） | https://googlechromelabs.github.io/chrome-for-testing/ |
| Appium 官方文档 | https://appium.io/docs/en/2.x/ |
| 大麦网 | https://www.damai.cn/ |
| 大麦 APP 下载 | https://www.damai.cn/app/index.htm |

---

*声明：本文档仅供本人自用购票流程参考。请遵守大麦网服务条款及相关法律法规，严禁倒卖牟利。*
