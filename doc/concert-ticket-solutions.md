# 演唱会抢票开源软件技术方案对比

> 调研目标：个人购票（非牟利）场景下，从 GitHub 筛选大麦网、猫眼、飞猪等平台成熟可用的开源抢票方案，形成选型参考。
>
> 调研日期：2026-04-17
> 数据源：GitHub Search API（star 数、最近 push 时间、README 内容）

---

## 1. 总览

### 1.1 筛选维度
- **成熟度**：star 数、fork 数、代码结构完备性、文档质量
- **活跃度**：最近 push 时间（2025 年后仍维护为优）
- **平台覆盖**：大麦 / 猫眼 / 票星球 / 纷玩岛 / 淘票票 / 缤玩岛
- **技术路线**：Selenium、接口直调、油猴脚本、安卓无障碍/AutoX.js
- **实用性**：是否支持选座、选人、多场次、回流监控

### 1.2 关于"飞猪"
GitHub 上**没有专门针对飞猪的演唱会抢票项目**。飞猪主业为旅游票务（机票/酒店/景点门票），演唱会票务市场实际由以下平台主导：

| 平台 | 主营 | 典型艺人/演出 |
|---|---|---|
| 大麦网 | 阿里系，国内最大 | 全品类 |
| 猫眼 | 美团系 | 与大麦双寡头 |
| 票星球（pxq） | 新兴平台 | 周杰伦、林俊杰独家 |
| 纷玩岛（fwd） | 新兴平台 | 多独家场次 |
| 淘票票 | 阿里系 | 电影为主，偶有演出 |
| 缤玩岛 | 小众平台 | 部分演出 |

**建议**：以大麦 + 猫眼 + 票星球 为主目标平台。

---

## 2. 成熟度 × 活跃度排名

按 `star × 活跃加权` 排序，并标注最近 push 时间。

| 排名 | 项目 | Stars | Forks | 最近 push | 主语言 | 平台 | 路线 |
|:-:|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 🥇 1 | [WECENG/ticket-purchase](https://github.com/WECENG/ticket-purchase) | 6,308 | 767 | 2026-02 ✅ | Python | 大麦 | Selenium + Appium |
| 🥈 2 | [MakiNaruto/Automatic_ticket_purchase](https://github.com/MakiNaruto/Automatic_ticket_purchase) | 5,445 | 933 | 2024-03 ⚠️ | Python | 大麦 | Selenium + 接口 |
| 🥉 3 | [shiyutim/tickets](https://github.com/shiyutim/tickets) | 3,143 | 414 | 2024-05 ⚠️ | Rust/Vue | 大麦 | 接口直调 + GUI |
| 4 | [Guyungy/damaihelper](https://github.com/Guyungy/damaihelper) | 3,026 | 496 | 2026-03 ✅ | Python/GUI | 大麦+淘票票+缤玩岛 | Selenium + OCR + GUI |
| 5 | [RookieTree/DaMaiHelper](https://github.com/RookieTree/DaMaiHelper) | 1,778 | 221 | 2024-11 ⚠️ | Kotlin | 大麦（安卓） | Android 无障碍 |
| 6 | [Pactum7/ticket-grabbing](https://github.com/Pactum7/ticket-grabbing) | 1,724 | 216 | 2026-03 ✅ | JavaScript | 猫眼+纷玩岛+大麦 | AutoX.js 安卓 |
| 7 | [LuckyDeepSea/DamaiHelper](https://github.com/LuckyDeepSea/DamaiHelper) | 666 | 96 | 2024-08 ⚠️ | Python | 大麦 | Selenium |
| 8 | [JnuMxin/damaiAuto](https://github.com/JnuMxin/damaiAuto) | 480 | 171 | 2022-04 ❌ | Python | 大麦 | Selenium |
| 9 | [DracoYan-111/damai_grab_votes](https://github.com/DracoYan-111/damai_grab_votes) | 449 | 69 | 2025-07（已 archive） | Python | 大麦 | Web/Android |
| 10 | [Jxpro/damai-tickets](https://github.com/Jxpro/damai-tickets) | 128 | 12 | 2023-10 ❌ | Python | 大麦 | 接口逆向 |
| 11 | [redhat1977/damai-ticket-assistant-app](https://github.com/redhat1977/damai-ticket-assistant-app) | 64 | 90 | 2025-10 ✅ | Python | 大麦 | Web + APP 双端 |
| 12 | [fuyinkai/maoyanbuy](https://github.com/fuyinkai/maoyanbuy) | 57 | 7 | 2024-07 ⚠️ | — | 猫眼 | 回流监控 |
| 13 | [ord-kivy/pxq-ticket](https://github.com/ord-kivy/pxq-ticket) | 41 | 3 | 2024-06 ⚠️ | Python | 票星球+猫眼+纷玩岛 | 接口逆向（含同盾风控破解） |

**图例**：✅ 2025 年后仍维护 | ⚠️ 2024 年后停更 | ❌ 2023 年前停更

---

## 3. 四大技术路线详解

### 3.1 路线 A：Selenium 浏览器自动化（Web 端）
**代表项目**：WECENG/ticket-purchase、MakiNaruto/Automatic_ticket_purchase、Guyungy/damaihelper

**原理**：用 Python + Selenium 驱动真实 Chrome/Edge，模拟人工点击选票 → 确认订单 → 提交。

| 优势 | 劣势 |
|---|---|
| ✅ 入门门槛最低，README 充足 | ❌ 速度慢（页面渲染+点击） |
| ✅ 不需要逆向接口签名 | ❌ 易被 webdriver 特征识别风控 |
| ✅ 平台改版后适配成本低（XPath 调整） | ❌ 需安装 ChromeDriver 版本匹配 |
| ✅ 可结合 OCR 识别验证码 | ❌ PC 大麦已削弱，很多热门只开 H5/APP |

**适用场景**：学习抢票原理、非顶级热门场次、PC 端开售的演出。

---

### 3.2 路线 B：接口直调 / 协议逆向
**代表项目**：shiyutim/tickets、Jxpro/damai-tickets、ord-kivy/pxq-ticket

**原理**：抓包分析大麦/票星球 H5/APP 接口，手工实现签名算法（sign/umidToken/同盾 blackbox），用 HTTP 客户端（Rust/Python/Go）直接请求下单接口。

| 优势 | 劣势 |
|---|---|
| ✅ **速度最快**（跳过 UI 渲染） | ❌ 签名/风控算法频繁变更，需持续逆向 |
| ✅ 并发多账号容易 | ❌ 门槛高，需懂加密/协议 |
| ✅ shiyutim/tickets 有 Tauri GUI，无需命令行 | ❌ 极易触发风控封号（非浏览器指纹） |
| ✅ 资源占用低 | ❌ 不支持选座（需走完整页面流程） |

**适用场景**：高级玩家、批量抢票、捡漏监控；需要较强维护能力。

---

### 3.3 路线 C：油猴脚本 / 浏览器插件
**代表项目**：传统 Tampermonkey 脚本生态

**原理**：在真实用户浏览器中注入 JS，监听页面状态变化，自动选票 + 提交。

| 优势 | 劣势 |
|---|---|
| ✅ 运行在真实浏览器，**指纹最真** | ❌ 只能一个窗口一个账号 |
| ✅ 装好即用，无需部署环境 | ❌ 只对 H5/PC 站有效，APP 端无解 |
| ✅ 风控识别难度较高 | ❌ 需手动触发/保持浏览器打开 |
| ✅ 适合手动介入选座 | — |

**适用场景**：不想折腾环境、只抢一两场、愿意全程盯着屏幕。

---

### 3.4 路线 D：安卓无障碍 / AutoX.js
**代表项目**：Pactum7/ticket-grabbing、RookieTree/DaMaiHelper

**原理**：
- **AutoX.js**（Pactum7）：安卓 JS 自动化引擎，通过无障碍服务读取 APP 控件并模拟点击
- **原生 Android 无障碍**（RookieTree）：Kotlin 写的系统级无障碍服务

| 优势 | 劣势 |
|---|---|
| ✅ 直接在 APP 内抢，**风控最弱**（APP 才是热门票主战场） | ❌ 需准备安卓设备/模拟器 |
| ✅ 不需要任何账号密码，走 APP 正常登录 | ❌ 多账号需多设备 |
| ✅ 覆盖猫眼/纷玩岛/大麦多平台 | ❌ 点击速度受限于系统帧率 |
| ✅ 无需 root（AutoX.js） | ❌ AutoX.js 停更版本需找第三方 fork |

**适用场景**：**最推荐普通用户**，手机党、热门票、多平台一键切换。

---

## 4. Top 5 项目深度对比

### 4.1 WECENG/ticket-purchase（综合第一）
- **Stars**: 6,308 | **最近更新**: 2026-02 ✅
- **技术栈**: Python 3.9+ / Selenium / Appium / Node.js 20+
- **核心**: PC（Selenium）+ 安卓（Appium）双端
- **功能**: 自动选城市/日期/价格/观演人，重试机制，自动提交
- **文档**: ⭐⭐⭐⭐⭐（v2.0.0 版本号、完整 README）
- **推荐人群**: 想深度二开、走双端组合、追求稳定
- **风险点**: Selenium 已被大麦风控重点识别，需自行加指纹伪装

### 4.2 MakiNaruto/Automatic_ticket_purchase（经典之祖）
- **Stars**: 5,445 | **最近更新**: 2024-03 ⚠️
- **技术栈**: Python3 / Selenium / Requests / BeautifulSoup
- **核心**: Selenium 登录拿 Cookie → Requests 直调接口
- **功能**: 自动登录、指定价格/座位、批量购票
- **文档**: ⭐⭐⭐⭐
- **推荐人群**: 学习抢票全流程、研究接口结构
- **风险点**: **作者声明已失效**（大麦购票迁移到手机端），接口需重新逆向

### 4.3 shiyutim/tickets（桌面 GUI 首选）
- **Stars**: 3,143 | **最近更新**: 2024-05 ⚠️
- **技术栈**: Tauri + Rust + Vue
- **核心**: Cookie 认证 + 调用大麦 H5 接口
- **功能**: 填入票档 → 自动提交 → 跳转官方订单页
- **文档**: ⭐⭐⭐⭐
- **推荐人群**: 非程序员、想要打包好的桌面应用
- **风险点**: **不支持选座**，H5 接口风控；需自备有效 Cookie

### 4.4 Guyungy/damaihelper（多平台活跃）
- **Stars**: 3,026 | **最近更新**: 2026-03 ✅（最活跃之一）
- **技术栈**: Python + Selenium + APScheduler + pytesseract OCR + GUI
- **核心**: 图形化 Windows 客户端，一键启动
- **功能**: 验证码 OCR、定时抢票、多场次并发、AI 选座算法、反检测指纹伪装
- **覆盖**: 大麦 / 淘票票 / 缤玩岛
- **文档**: ⭐⭐⭐⭐⭐
- **推荐人群**: Windows 用户、想要开箱即用、不只抢大麦
- **风险点**: Python 环境配置需匹配 Chrome 驱动版本

### 4.5 Pactum7/ticket-grabbing（移动端首选）
- **Stars**: 1,724 | **最近更新**: 2026-03 ✅（最活跃之一）
- **技术栈**: AutoX.js（安卓 JS 自动化）
- **核心**: 移动端 APP 内模拟点击
- **功能**: 卡点抢票（MaoYanGoNew.js）、余票监控（MaoYanMonitor.js）、自动选观演人、webhook/响铃通知
- **覆盖**: 猫眼 / 纷玩岛 / 大麦
- **文档**: ⭐⭐⭐⭐
- **推荐人群**: **普通用户最推荐**，只用手机、要抢热门票
- **风险点**: 需学会 AutoX.js 环境配置；页面解析需调试

---

## 5. 选型决策

### 一句话推荐
| 用户画像 | 首选 | 备选 |
|---|---|---|
| **普通用户，手机抢** | Pactum7/ticket-grabbing | RookieTree/DaMaiHelper |
| **Windows 用户，图形化** | Guyungy/damaihelper | shiyutim/tickets |
| **macOS/Linux，桌面 GUI** | shiyutim/tickets | — |
| **开发者，要二开** | WECENG/ticket-purchase | MakiNaruto/Automatic_ticket_purchase |
| **抢票星球（JJ/周杰伦）** | ord-kivy/pxq-ticket | — |
| **抢猫眼/纷玩岛** | Pactum7/ticket-grabbing | fuyinkai/maoyanbuy |

### 按场景决策

```
                 你想抢什么？
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    大麦热门      猫眼/纷玩岛      票星球
        │             │             │
        │             ▼             ▼
        │       Pactum7/         ord-kivy/
        │       ticket-grabbing  pxq-ticket
        │
        ▼
   你有开发能力？
        │
   ┌────┴────┐
   否        是
   │         │
   ▼         ▼
非程序员    WECENG/ticket-purchase (Py+Appium 双端)
   │
   ├─ 要桌面 GUI → shiyutim/tickets
   ├─ 要 Windows GUI → Guyungy/damaihelper
   └─ 手机党 → Pactum7/ticket-grabbing
```

---

## 6. 风险与合规提示

### 6.1 账号风险
- **Selenium 特征检测**：大麦使用同盾风控（blackbox），会识别 `navigator.webdriver` 等特征 → 建议使用 `undetected-chromedriver` 或走 CDP 协议
- **IP 集中**：多账号同一 IP 高频下单 → 触发风控 → 必要时走代理池
- **设备指纹**：同一设备反复抢票 → 绑定风险 → 慎用真实账号

### 6.2 接口失效周期
- 大麦 H5 接口签名算法 **平均每 3–6 个月变更一次**
- 同盾 blackbox 风险值 2024 年起门槛大幅提高
- **老项目（2022 年前）接口几乎 100% 失效**，不要直接跑

### 6.3 法律边界
- **合法**：本人购票自用、家人朋友代购
- **灰色**：超过本人实际需求的囤票
- **违法**：倒卖牟利（违反《反不正当竞争法》及文旅部《营业性演出管理条例》）
- **平台 ToS**：大麦/猫眼用户协议均禁止自动化工具，**可能封号**

### 6.4 实操建议
1. **优先 APP 端方案**（AutoX.js/无障碍）：风控最弱
2. **提前测试**：在小众场次/模拟环境走通完整流程
3. **多手段并行**：自己蹲 + 脚本 + 亲友蹲票，不把希望压在单一工具
4. **做好失败预期**：大麦 SVIP 场次脚本命中率也 <20%
5. **关注回流**：开售后 24–72h 的退款回流池，脚本命中率远高于开售瞬间

---

## 7. 附录：完整项目清单速查

| 项目 | Star | 更新 | 平台 | 特点 |
|---|---|---|---|---|
| [WECENG/ticket-purchase](https://github.com/WECENG/ticket-purchase) | 6.3k | 2026-02 | 大麦 | Python+Appium，双端 |
| [MakiNaruto/Automatic_ticket_purchase](https://github.com/MakiNaruto/Automatic_ticket_purchase) | 5.4k | 2024-03 | 大麦 | 经典 Selenium+接口 |
| [shiyutim/tickets](https://github.com/shiyutim/tickets) | 3.1k | 2024-05 | 大麦 | Tauri 桌面 GUI |
| [Guyungy/damaihelper](https://github.com/Guyungy/damaihelper) | 3.0k | 2026-03 | 大麦+淘票票+缤玩岛 | Windows GUI，OCR 验证码 |
| [RookieTree/DaMaiHelper](https://github.com/RookieTree/DaMaiHelper) | 1.8k | 2024-11 | 大麦 | Android 无障碍（Kotlin） |
| [Pactum7/ticket-grabbing](https://github.com/Pactum7/ticket-grabbing) | 1.7k | 2026-03 | 猫眼+纷玩岛+大麦 | AutoX.js 安卓 |
| [LuckyDeepSea/DamaiHelper](https://github.com/LuckyDeepSea/DamaiHelper) | 666 | 2024-08 | 大麦 | Python Selenium |
| [JnuMxin/damaiAuto](https://github.com/JnuMxin/damaiAuto) | 480 | 2022-04 | 大麦 | 早期 Selenium 刷新脚本 |
| [DracoYan-111/damai_grab_votes](https://github.com/DracoYan-111/damai_grab_votes) | 449 | 2025-07 | 大麦 | Web+Android（已 archive） |
| [Jxpro/damai-tickets](https://github.com/Jxpro/damai-tickets) | 128 | 2023-10 | 大麦 | 接口逆向案例 |
| [redhat1977/damai-ticket-assistant-app](https://github.com/redhat1977/damai-ticket-assistant-app) | 64 | 2025-10 | 大麦 | Web+APP |
| [fuyinkai/maoyanbuy](https://github.com/fuyinkai/maoyanbuy) | 57 | 2024-07 | 猫眼 | 回流/库存监控 |
| [ord-kivy/pxq-ticket](https://github.com/ord-kivy/pxq-ticket) | 41 | 2024-06 | 票星球+猫眼+纷玩岛 | 同盾风控破解 |

---

## 8. 下一步建议

1. **先装 `Pactum7/ticket-grabbing`**（手机，最稳）验证能否跑通目标场次
2. **同时开 `Guyungy/damaihelper`**（PC，最新维护）做双保险
3. 目标场次若在票星球/纷玩岛独家 → 加 `ord-kivy/pxq-ticket` 作为第三路
4. 开售前 48 小时做一次完整演练（用小额场次试）
5. **把开售瞬间 + 回流监控（24–72h）两个时段都跑起来**

---

*声明：本文档仅供技术研究与本人购票自用参考。请勿用于倒卖牟利，并自行承担平台 ToS 与法律风险。*
