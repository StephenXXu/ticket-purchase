# -*- coding: UTF-8 -*-
"""
__Author__ = "stephenXu"
__Version__ = "3.0.0-daemon"
__Description__ = "大麦抢票 daemon 模式 - driver 长驻，多次抢票复用同一 session，第 2 次起完全无闪屏"
__Created__ = 2026-04-29

设计理念：
    v2 每次跑完 driver.quit()，下次再跑要重新启动 io.appium.uiautomator2.server
    Android 系统启动 instrumentation runner 时 APP 会短暂失焦 = 视觉上「闪一下」
    v3 把 driver 长驻，REPL 循环复用 session：
      第 1 次启动：闪一下（不可避免，Appium 启动 instrumentation 必然）
      第 2 次起：完全无闪 + 0.5-1 秒完成

用法：
    cd damai_appium
    poetry run python damai_app_v3_daemon.py

    启动后进入 REPL：
      [Enter] 跑一次抢票
      c       重新加载 config.jsonc
      s       查看当前 config
      q       退出 daemon
      Ctrl+C  也优雅退出

适用场景：
    - 演练时反复跑（每次只闪 1 次）
    - 刷回流票
    - 连续抢相邻场次
"""
import time
import sys
from appium import webdriver
from appium.options.common.base import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from config import Config

RED = "\033[1;31m"
GRN = "\033[1;32m"
YEL = "\033[1;33m"
BLU = "\033[1;34m"
INV = "\033[7m"
NC = "\033[0m"


class DamaiDaemon:
    """driver 长驻版抢票 bot"""

    def __init__(self):
        self.config = Config.load_config()
        self.driver = None
        self.wait = None
        self._setup_driver()

    def _setup_driver(self):
        """driver 仅初始化一次（第 1 次启动会闪一下）"""
        capabilities = {
            "platformName": "Android",
            "platformVersion": "16",
            "deviceName": "emulator-5554",
            "appPackage": "cn.damai",
            "unicodeKeyboard": True,
            "resetKeyboard": True,
            "noReset": True,
            "newCommandTimeout": 60000,
            "automationName": "UiAutomator2",
            "skipServerInstallation": False,
            "ignoreHiddenApiPolicyError": True,
            "disableWindowAnimation": True,
            "mjpegServerFramerate": 1,
            "shouldTerminateApp": False,
            "adbExecTimeout": 20000,
            "dontStopAppOnReset": True,
            "forceAppLaunch": False,
        }
        opts = AppiumOptions()
        opts.load_capabilities(capabilities)
        self.driver = webdriver.Remote(self.config.server_url, options=opts)
        self.driver.update_settings({
            "waitForIdleTimeout": 0,
            "actionAcknowledgmentTimeout": 0,
            "keyInjectionDelay": 0,
            "waitForSelectorTimeout": 300,
            "ignoreUnimportantViews": False,
            "allowInvisibleElements": True,
            "enableNotificationListener": False,
        })
        self.wait = WebDriverWait(self.driver, 2)

    def reload_config(self):
        old = (self.config.price_index, self.config.users, self.config.if_commit_order)
        self.config = Config.load_config()
        new = (self.config.price_index, self.config.users, self.config.if_commit_order)
        print(f"  {GRN}✓ config 已重载{NC}")
        print(f"    price_index: {old[0]} → {new[0]}")
        print(f"    users:       {old[1]} → {new[1]}")
        print(f"    if_commit:   {old[2]} → {new[2]}")

    def show_config(self):
        c = self.config
        commit_color = RED if c.if_commit_order else GRN
        print(f"  当前 config:")
        print(f"    keyword:     {c.keyword}")
        print(f"    city:        {c.city}")
        print(f"    date/price:  {c.date} / {c.price}")
        print(f"    price_index: {c.price_index}")
        print(f"    users:       {c.users}")
        print(f"    if_commit_order: {commit_color}{c.if_commit_order}{NC}")

    def ultra_fast_click(self, by, value, timeout=1.5):
        try:
            el = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            rect = el.rect
            self.driver.execute_script("mobile: clickGesture", {
                "x": rect["x"] + rect["width"] // 2,
                "y": rect["y"] + rect["height"] // 2,
                "duration": 50,
            })
            return True
        except TimeoutException:
            return False

    def smart_wait_and_click(self, by, value, backup_selectors=None, timeout=1.5):
        selectors = [(by, value)]
        if backup_selectors:
            selectors.extend(backup_selectors)
        for sel_by, sel_val in selectors:
            try:
                el = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((sel_by, sel_val))
                )
                rect = el.rect
                self.driver.execute_script("mobile: clickGesture", {
                    "x": rect["x"] + rect["width"] // 2,
                    "y": rect["y"] + rect["height"] // 2,
                    "duration": 50,
                })
                return True
            except TimeoutException:
                continue
        return False

    def ultra_batch_click(self, elements_info, timeout=2):
        coordinates = []
        for by, value in elements_info:
            try:
                el = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((by, value))
                )
                rect = el.rect
                coordinates.append((
                    rect["x"] + rect["width"] // 2,
                    rect["y"] + rect["height"] // 2,
                    value,
                ))
            except TimeoutException:
                print(f"超时未找到用户: {value}")
            except Exception as e:
                print(f"查找用户失败 {value}: {e}")
        print(f"成功找到 {len(coordinates)} 个用户")
        for i, (x, y, value) in enumerate(coordinates):
            self.driver.execute_script("mobile: clickGesture", {
                "x": x, "y": y, "duration": 30
            })
            if i < len(coordinates) - 1:
                time.sleep(0.01)
            print(f"点击用户: {value}")

    def try_grab(self):
        """单次抢票，driver 不 quit"""
        try:
            print(f"{BLU}开始抢票流程...{NC}")
            start = time.time()

            # 1. 智能跳过 city
            already_on_detail = len(
                self.driver.find_elements(
                    By.ID,
                    "cn.damai:id/trade_project_detail_purchase_status_bar_container_fl",
                )
            ) > 0
            if already_on_detail:
                print("✓ 已在演出详情页，跳过城市选择")
            else:
                print("选择城市...")
                city_selectors = [
                    (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().text("{self.config.city}")'),
                    (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().textContains("{self.config.city}")'),
                    (By.XPATH, f'//*[@text="{self.config.city}"]'),
                ]
                if not self.smart_wait_and_click(*city_selectors[0], city_selectors[1:]):
                    print(f"{RED}✗ 城市选择失败{NC}")
                    return False

            # 2. 点底部按钮
            print("点击预约/立即购买按钮...")
            book_selectors = [
                (By.ID, "cn.damai:id/trade_project_detail_purchase_status_bar_container_fl"),
                (AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().textMatches(".*预约.*|.*购买.*|.*立即.*|.*抢票.*|.*特惠.*")'),
                (By.XPATH, '//*[contains(@text,"预约") or contains(@text,"购买") or contains(@text,"立即")]'),
            ]
            if not self.smart_wait_and_click(*book_selectors[0], book_selectors[1:]):
                print(f"{RED}✗ 预约按钮点击失败{NC}")
                return False

            # 3. 选票价 + 售罄拦截
            print("选择票价...")
            SOLD_OUT = ("缺货登记", "已售罄", "票已售完", "无票", "暂无余票")

            def _sold_out(target):
                try:
                    sub_texts = []
                    for s in target.find_elements(AppiumBy.XPATH, ".//*"):
                        try:
                            t = s.text
                            if t:
                                sub_texts.append(t)
                        except Exception:
                            continue
                    joined = " ".join(sub_texts)
                    for kw in SOLD_OUT:
                        if kw in joined:
                            return kw, joined
                except Exception:
                    pass
                return None, ""

            try:
                price_container = self.driver.find_element(
                    By.ID, "cn.damai:id/project_detail_perform_price_flowlayout"
                )
                target_price = price_container.find_element(
                    AppiumBy.ANDROID_UIAUTOMATOR,
                    f'new UiSelector().className("android.widget.FrameLayout").index({self.config.price_index}).clickable(true)',
                )
                kw, joined = _sold_out(target_price)
                if kw:
                    print(f"{RED}✗ price_index={self.config.price_index} 已售罄（命中「{kw}」），按「只抢配置档」策略立即退出{NC}")
                    return False
                self.driver.execute_script("mobile: clickGesture", {"elementId": target_price.id})
            except Exception as e:
                print(f"票价主方案失败（{type(e).__name__}），启动备用方案带 wait")
                price_container = self.wait.until(
                    EC.presence_of_element_located(
                        (By.ID, "cn.damai:id/project_detail_perform_price_flowlayout")
                    )
                )
                target_price = price_container.find_element(
                    AppiumBy.ANDROID_UIAUTOMATOR,
                    f'new UiSelector().className("android.widget.FrameLayout").index({self.config.price_index}).clickable(true)',
                )
                kw, joined = _sold_out(target_price)
                if kw:
                    print(f"{RED}✗ price_index={self.config.price_index} 已售罄（备用方案命中），退出{NC}")
                    return False
                self.driver.execute_script("mobile: clickGesture", {"elementId": target_price.id})

            # 4. 选数量
            print("选择数量...")
            if self.driver.find_elements(by=By.ID, value="layout_num"):
                clicks_needed = len(self.config.users) - 1
                if clicks_needed > 0:
                    try:
                        plus_button = self.driver.find_element(By.ID, "img_jia")
                        for _ in range(clicks_needed):
                            rect = plus_button.rect
                            self.driver.execute_script("mobile: clickGesture", {
                                "x": rect["x"] + rect["width"] // 2,
                                "y": rect["y"] + rect["height"] // 2,
                                "duration": 50,
                            })
                            time.sleep(0.02)
                    except Exception as e:
                        print(f"快速点击加号失败: {e}")

            # 5. 确定购买
            print("确定购买...")
            if not self.ultra_fast_click(By.ID, "btn_buy_view"):
                self.ultra_fast_click(
                    AppiumBy.ANDROID_UIAUTOMATOR,
                    'new UiSelector().textMatches(".*确定.*|.*购买.*")',
                )

            # 6. 选用户
            print("选择用户...")
            user_clicks = [
                (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().text("{u}")')
                for u in self.config.users
            ]
            self.ultra_batch_click(user_clicks)

            # 7. 提交订单
            if not getattr(self.config, "if_commit_order", True):
                print(f"{YEL}⚠️ 冒烟模式 (if_commit_order=false)：跳过提交订单{NC}")
            else:
                print("提交订单...")
                submit_selectors = [
                    (AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().text("立即提交")'),
                    (AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().textMatches(".*提交.*|.*确认.*")'),
                    (By.XPATH, '//*[contains(@text,"提交")]'),
                ]
                self.smart_wait_and_click(*submit_selectors[0], submit_selectors[1:])

            elapsed = time.time() - start
            print(f"{GRN}🏁 抢票流程完成，耗时: {elapsed:.2f}秒{NC}")
            return True

        except Exception as e:
            print(f"{RED}✗ 抢票出错: {type(e).__name__}: {e}{NC}")
            return False
        # ⚠️ 关键：不 driver.quit()！

    def quit(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None


def main():
    print(f"{BLU}🚀 大麦抢票 daemon 模式启动{NC}")
    print(f"{BLU}   driver 启动中（首次会闪一下，约 3-4 秒）...{NC}")
    bot = DamaiDaemon()
    print(f"{GRN}   ✅ driver 就绪{NC}\n")
    bot.show_config()
    print()
    print(f"{BLU}命令：{NC}")
    print(f"  {GRN}[Enter]{NC}     跑一次抢票（复用 driver，无闪屏）")
    print(f"  {GRN}c{NC}           重新加载 config.jsonc")
    print(f"  {GRN}s{NC}           查看当前 config")
    print(f"  {GRN}q / Ctrl+C{NC}  退出 daemon")

    try:
        round_num = 0
        while True:
            try:
                cmd = input(f"\n{INV} round {round_num+1} {NC} > ").strip().lower()
            except EOFError:
                break
            if cmd == "q":
                break
            elif cmd == "c":
                bot.reload_config()
            elif cmd == "s":
                bot.show_config()
            elif cmd == "":
                round_num += 1
                bot.try_grab()
            else:
                print(f"  {YEL}未知命令: {cmd!r}{NC}")
    except KeyboardInterrupt:
        print(f"\n{YEL}🛑 用户中断{NC}")
    finally:
        print(f"{BLU}退出 daemon，关闭 driver...{NC}")
        bot.quit()
        print(f"{GRN}🏁 daemon 已退出{NC}")


if __name__ == "__main__":
    main()
