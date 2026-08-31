# -*- coding: UTF-8 -*-
"""
__Author__ = "stephenXu"
__Version__ = "1.0.0"
__Description__ = "运行设备自动探测：真机 / 模拟器通用，替代写死的 emulator-5554 + platformVersion"
__Created__ = 2026-08-31

用法：
    from device import detect_device
    dev = detect_device()          # 无可用设备直接抛 DeviceNotFoundError
    dev.udid / dev.platform_version / dev.model

指定设备（多台在线时）：
    export DAMAI_UDID=391QYFDK224SN
"""
import os
import subprocess
from dataclasses import dataclass


class DeviceNotFoundError(RuntimeError):
    """adb 找不到处于 device 状态的设备"""


@dataclass(frozen=True)
class Device:
    udid: str
    platform_version: str
    sdk: str
    model: str

    def describe(self):
        return f"{self.model} (udid={self.udid}, Android {self.platform_version}/API {self.sdk})"


def _adb(args, timeout=15):
    """跑一条 adb 命令并返回 stdout；非 0 退出码直接抛，不吞错"""
    result = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"adb {' '.join(args)} 失败(exit={result.returncode}): {result.stderr.strip()}")
    return result.stdout.strip()


def list_devices():
    """返回 [(udid, state)]，state 取值 device / unauthorized / offline"""
    rows = []
    for line in _adb(["devices"]).splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 2:
            rows.append((parts[0], parts[1]))
    return rows


def _getprop(udid, prop):
    return _adb(["-s", udid, "shell", "getprop", prop]).strip()


def detect_device():
    """探测目标设备：DAMAI_UDID 优先，否则取唯一在线设备"""
    devices = list_devices()
    online = [udid for udid, state in devices if state == "device"]

    wanted = os.environ.get("DAMAI_UDID")
    if wanted:
        if wanted not in online:
            raise DeviceNotFoundError(
                f"DAMAI_UDID={wanted} 不在可用设备中，当前 adb devices: {devices or '空'}"
            )
        udid = wanted
    elif not online:
        unauthorized = [u for u, s in devices if s == "unauthorized"]
        hint = (
            f"设备 {unauthorized} 状态 unauthorized —— 手机上点「允许 USB 调试」并勾选一律允许"
            if unauthorized
            else "adb devices 为空 —— 检查 USB 调试是否打开、数据线是否为数据线、USB 模式是否为传输文件(MTP)"
        )
        raise DeviceNotFoundError(hint)
    elif len(online) > 1:
        raise DeviceNotFoundError(f"检测到多台设备 {online}，请用 DAMAI_UDID=<udid> 指定一台")
    else:
        udid = online[0]

    return Device(
        udid=udid,
        platform_version=_getprop(udid, "ro.build.version.release"),
        sdk=_getprop(udid, "ro.build.version.sdk"),
        model=_getprop(udid, "ro.product.model") or udid,
    )


def assert_app_installed(udid, package="cn.damai"):
    """确认目标 APP 已装，未装直接抛"""
    if package not in _adb(["-s", udid, "shell", "pm", "list", "packages", package]):
        raise DeviceNotFoundError(f"设备 {udid} 未安装 {package}")


if __name__ == "__main__":
    dev = detect_device()
    assert_app_installed(dev.udid)
    print(dev.describe())
