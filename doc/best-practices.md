# 三工具联动抢票最佳实践

> 工具组合：`Pactum7/ticket-grabbing`（安卓 AutoX.js）+ `Guyungy/damaihelper`（Windows GUI）+ `WECENG/ticket-purchase`（Python+Appium 双端）
>
> 核心思想：**三线并行、互为备份、全平台覆盖**，不把希望押在单一工具上。
>
> 编写日期：2026-04-17

---

## 1. 三工具定位与分工

| 工具 | 运行端 | 技术路线 | 适合平台 | 抢票角色 |
|---|---|---|---|---|
| **Pactum7/ticket-grabbing** | 安卓手机/模拟器 | AutoX.js 无障碍 | 猫眼 / 纷玩岛 / 大麦 | **主力**：热门票、APP 端独占 |
| **Guyungy/damaihelper** | Windows PC | Selenium + OCR + GUI | 大麦 / 淘票票 / 缤玩岛 | **副攻**：PC 端开售、验证码场次 |
| **WECENG/ticket-purchase** | PC + 安卓双端 | Selenium + Appium | 大麦 | **远征军**：大麦深度定制、二开入口 |

**分工原则**：
- 开售瞬间：三工具同时启动，互为备份，谁先成功就走谁
- 余票监控：Pactum7 的 `MaoYanMonitor.js` + Guyungy 定时刷新 双通道
- 多账号：每个工具绑定 1 个账号（避免同一账号多端高频触发风控）

---

## 2. 开售前 72 小时：部署准备

### 2.1 账号准备（最关键）
| 项 | 说明 |
|---|---|
| **实名认证** | 每个账号必须完成实名（大麦强实名制，开售后不能改） |
| **观演人** | 提前添加观演人信息（身份证+手机号），一个账号最多 3–5 人 |
| **收货地址** | 填写（纸质票需要）/ 默认电子票忽略 |
| **支付方式** | 预先绑定支付宝+免密支付；**关键**，省 3–5 秒 |
| **账号年龄** | 用注册 > 3 个月的老号，新号风控极严 |
| **账号池** | 准备 2–3 个账号分配到不同工具/不同设备 |

### 2.2 硬件准备
```
安卓手机/模拟器      Windows PC
      ├── Pactum7       ├── Guyungy/damaihelper
      ├── 大麦/猫眼APP  ├── Chrome + ChromeDriver
      └── AutoX.js      └── Python 3.8+

Mac/另一台设备
      └── WECENG/ticket-purchase（PC 端或 Appium 端）
```

**网络**：
- 三台设备接入**不同 IP**（家宽 + 手机 4G/5G + 公司网/代理）
- 避免同 WiFi 下多端并发（IP 聚集触发风控）
- 开售前测 ping：大麦接入 `www.damai.cn` 应 < 50ms

### 2.3 工具安装清单

#### A. Pactum7/ticket-grabbing（安卓）
```
# 1. 安卓设备安装 AutoX.js 6.5.8（作者指定版本）
#    下载: https://github.com/kkevsekk1/AutoX/releases
# 2. 打开 AutoX.js → 授予无障碍、悬浮窗、通知权限
# 3. git clone https://github.com/Pactum7/ticket-grabbing
# 4. 把 .js 脚本通过 AutoX.js Web IDE 导入手机
# 5. 编辑脚本头部配置：
#    - 目标场次 URL 或关键词
#    - 最高票价
#    - 观演人索引（第几个）
#    - webhook 通知地址（可选，用 Bark / 企业微信机器人）
```

**核心脚本选择**：
- `MaoYanGoNew.js` → 整点卡点抢新票
- `MaoYanMonitor.js` → **回流监控**（开售后 24–72 h 必跑）
- `FenWanDaoGo.js` → 纷玩岛场次

#### B. Guyungy/damaihelper（Windows）
```
# 1. 装 Python 3.8+ 和 Chrome 最新版
# 2. git clone https://github.com/Guyungy/damaihelper
# 3. cd damaihelper && pip install -r requirements.txt
# 4. 下载对应 Chrome 主版本号的 chromedriver.exe 放入项目根
#    https://googlechromelabs.github.io/chrome-for-testing/
# 5. 编辑 config/ 下配置文件，填入：
#    - 平台（damai/taopiaopiao/binwandao）
#    - 演出 URL
#    - 票档、人数、刷新频率
# 6. 双击 "win一键运行.bat" 或 python GUI.py
# 7. GUI 里扫码登录（Cookie 会自动保存）
```

**⚠️ 坑**：ChromeDriver 版本必须和 Chrome **主版本号**一致（如 131.x ↔ 131.x），不匹配直接崩。

#### C. WECENG/ticket-purchase（Python + Appium）
```
# 1. Python 3.9+ + Node.js 20.19.0+
# 2. npm install -g appium
# 3. appium driver install uiautomator2
# 4. 设置 ANDROID_HOME、ANDROID_SDK_ROOT 环境变量
# 5. adb devices 确认安卓设备已连 USB 调试
# 6. git clone https://github.com/WECENG/ticket-purchase
# 7. 编辑 config.json / config.jsonc（Web / Appium 两套）
#    - 演出详情页 URL
#    - 观演人员列表
#    - 城市、日期、票价
#    - 自动提交订单：true
# 8. 启动 appium 服务 → 运行主脚本
```

**双端选择**：推荐 **Appium 端**（直接操 APP 风控最弱），PC 端 Selenium 作为备份。

---

## 3. 开售前 1 小时：联调与演练

### 3.1 最后检查清单（开售前 60 min）
- [ ] 三工具都能跑到"选票档"步骤（用小众低价场次试）
- [ ] 每个账号都已登录且 Cookie/Token 未过期
- [ ] 每个账号绑定了目标观演人
- [ ] 每个账号支付宝免密已开启
- [ ] 三台设备时间同步（误差 < 1s，大麦服务器时间 = 北京时间）
  - Windows：`w32tm /resync`
  - Mac：`sudo sntp -sS time.apple.com`
  - Android：设置 → 自动设置时间
- [ ] 三工具日志路径打开，方便看错误
- [ ] webhook 通知测试一次（别到抢到了才发现通知不通）

### 3.2 时间校准（重要）
大麦服务器时间 ≈ 北京时间，但 NTP 对齐到 **阿里云 NTP** 最稳：
```
ntp1.aliyun.com
ntp2.aliyun.com
```

### 3.3 节奏分配
| 账号/设备 | 工具 | 目标 | 启动时间 |
|---|---|---|---|
| 账号 A / 手机 | Pactum7 MaoYanGoNew | 猫眼首选场次 | T-30s 启动 |
| 账号 B / Windows | Guyungy damaihelper | 大麦备选场次 | T-30s 启动 |
| 账号 C / Mac | WECENG Appium | 大麦同一场次 | T-30s 启动 |
| 账号 A / 手机 | Pactum7 MaoYanMonitor | 开售后回流监控 | T+10min 启动 |

`T` = 开售时刻

---

## 4. 开售瞬间：T-0 到 T+60s

### 4.1 人机配合最优解
**不要全靠脚本**。脚本命中率在热门票 < 20%，**自己手动点依然是主力**：

```
 T-5s:  手动把 APP/网页停在"立即购买"页面
 T=0:   脚本触发 + 自己手指点击
 T+1s:  谁先进订单页就谁付钱
 T+3s:  没进订单页的，脚本会自动重试
 T+30s: 没抢到，立即切换回流监控
```

### 4.2 并行原则
- **同一场次可用不同账号同时抢**（每账号 1 设备 1 工具）
- **同一账号绝不多端同时登录**（会互踢登录态）
- **不同工具抢不同场次**（A 账号抢 580，B 账号抢 1280，提升整体命中）

### 4.3 付款阶段
- 订单生成后**默认 15 分钟付款倒计时**（部分热门 5 分钟）
- 免密支付能省 3–5 秒，可能就是 "保单" 和 "订单取消" 的分界
- 付款成功前不要切 APP / 不要关电脑

---

## 5. 回流监控：T+10min 到 T+72h

热门场次**回流捡漏命中率 > 首发**，重点做这一阶段：

### 5.1 Pactum7 的 `MaoYanMonitor.js`
```
// 脚本头部配置（示意）
target_price_max: 1280        // 只要这价位以下
refresh_interval_ms: 800      // 0.8s 刷一次
notify_webhook: "https://bark.xxx/yyy"   // Bark 推送
auto_buy: true                // 出现立即自动下单
```

### 5.2 Guyungy 定时任务
- 利用 APScheduler 能力，每隔 5 s 检查目标场次
- 发现余票自动触发抢票流程
- 建议配合 Windows 任务计划跑 24 小时

### 5.3 关键时间窗口
| 窗口 | 说明 | 命中率 |
|---|---|---|
| 开售 +10 min | 秒杀后未付款退回 | ⭐⭐⭐⭐⭐ 最高 |
| 开售 +24 h | 第一波退款回流 | ⭐⭐⭐⭐ |
| 开售 +72 h | 最后退款回流 | ⭐⭐⭐ |
| 演出前 7 天 | 强制实名前退票潮 | ⭐⭐⭐⭐ |
| 演出前 24 h | 急售/加场 | ⭐⭐ |

---

## 6. 风控规避最佳实践

### 6.1 IP 层
- 三设备用三个 IP（家宽 + 4G + 代理）
- 不要用数据中心 IP（机房代理直接拉黑）
- 若用代理，选 **住宅代理**（如 Bright Data / Oxylabs），别用免费 HTTP 代理

### 6.2 账号层
| 做法 | 原因 |
|---|---|
| 账号预热 1 周（每天登录逛项目） | 模拟正常用户行为 |
| 开售前 2 小时保持登录态 | 避免登录瞬间风控 |
| 1 账号 1 设备 1 工具 | 避免关联封号 |
| 慎用小号囤票 | 大麦实名一次绑死，退票难 |

### 6.3 设备层
- **Guyungy Selenium**：README 提到已有指纹伪装，建议额外加 `undetected-chromedriver`
  ```
  import undetected_chromedriver as uc
  driver = uc.Chrome()
  ```
- **WECENG Web 端**：同上
- **Pactum7 AutoX.js**：天然真机，无需额外处理

### 6.4 行为层
- 点击间隔加随机抖动（50–200ms）
- 滑动轨迹避免完全直线
- 不要 0 秒完成"选座→观演人→支付"全流程（正常用户至少 10s+）

---

## 7. 常见坑与异常处理

### 7.1 Pactum7
| 症状 | 处理 |
|---|---|
| 启动无反应 | 点一次"缺货登记"→关闭弹窗即可（作者声明） |
| 无障碍权限失效 | 系统更新后常发生，重开一下开关 |
| AutoX.js 崩溃 | 降级到 6.5.8 稳定版，别用最新 beta |
| 找不到控件 | 大麦/猫眼 APP 改版，等脚本更新或自己调 selector |

### 7.2 Guyungy
| 症状 | 处理 |
|---|---|
| `session not created: This version of ChromeDriver` | 下载匹配主版本的 chromedriver |
| 验证码识别错 | OCR 训练集旧，建议人工介入 |
| 扫码登录后 Cookie 丢失 | 清 `config/cookies.json` 重新扫 |
| `CREATE_PROCESS` 失败 | Chrome 进程残留，任务管理器杀掉 |

### 7.3 WECENG
| 症状 | 处理 |
|---|---|
| `adb devices` 空 | 打开手机 USB 调试 + 授权电脑 |
| Appium 连接失败 | `appium driver list --installed` 确认 uiautomator2 装好 |
| 元素定位失败 | 用 Appium Inspector 重新抓 xpath |
| 重试次数耗尽 | 配置 `max_retry: 50`，但别太大（刷接口风险） |

### 7.4 全局兜底
- **每个工具都配 webhook 通知**（Bark/企业微信/Server 酱），失败立即知道
- **手动保底**：手机上同时自己点，别全信脚本
- **准备备选场次**：主场次抢不到立即切 B 场（脚本改参数即可）

---

## 8. 合规与边界

### 8.1 绝对不做
- ❌ 使用他人身份证抢票
- ❌ 抢到后加价倒卖（违反《反不正当竞争法》）
- ❌ 攻击或穷举平台验证码接口
- ❌ 公开分享抢到的账号/Cookie

### 8.2 可做（自用边界内）
- ✅ 为自己和家人朋友（现场同行）抢票
- ✅ 用开源脚本提升操作速度
- ✅ 监控回流信息（只监控、不黄牛）

### 8.3 被封号应对
- 封号一般是"登录异常" → 支付宝实名申诉可解
- 永久封号极少，绝大多数是 24–72 h 临时限制
- **千万别用主账号囤票**，留个干净账号备用

---

## 9. 快速 Checklist（打印贴墙上）

```
开售前 1 周
  [ ] 账号实名 + 观演人 + 支付方式
  [ ] 三工具部署完成并跑通小场次
  [ ] 每账号分配好工具/设备

开售前 1 小时
  [ ] NTP 对时
  [ ] 三工具停在最后一步
  [ ] 网络切换/代理开启
  [ ] webhook 通知测试

T-30s
  [ ] 启动所有脚本
  [ ] 手指停在"立即购买"按钮上

T+0
  [ ] 脚本+手动双线抢
  [ ] 进订单页立即付款（免密开着）

T+10min
  [ ] 没抢到？启动回流监控脚本
  [ ] 设好 webhook 挂机

T+72h
  [ ] 回流监控继续跑
  [ ] 演出前 7 天再重点关注一次
```

---

## 10. 进阶：统一监控仪表盘（可选）

如果时间充裕，可以用这三个工具当后端，前面套一层统一 dashboard：

```
┌─────────── Web Dashboard (Next.js) ───────────┐
│  场次 A / 580 元  [猫眼]  Pactum7  ●抢票中  │
│  场次 A / 580 元  [大麦]  Guyungy  ●监控中  │
│  场次 A / 1280元  [大麦]  WECENG   ●待命    │
│  [日志区]                                     │
│  [14:00:01] Pactum7: 进入选票页              │
│  [14:00:03] Pactum7: 提交订单成功 🎉        │
└──────────────────────────────────────────────┘
      ↓ webhook/HTTP
  ┌─────────┬─────────┬──────────┐
  │ Pactum7 │ Guyungy │  WECENG  │
  │ (安卓)  │ (Win)   │ (双端)   │
  └─────────┴─────────┴──────────┘
```

每个工具都用 webhook 把状态上报到 dashboard，实现**统一监控、统一告警**。超出个人抢票场景可以不做，作为后续扩展思路。

---

*声明：仅供本人自用购票参考。平台 ToS 与法律风险由使用者自行承担。抢到票请去现场好好享受演出。*
