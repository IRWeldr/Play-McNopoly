import threading
import subprocess
import time
import os
import glob
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEVICE_PROFILES = {
    "SM-S911W": {
        "name": "Samsung Galaxy S23 (SM-S911W)",
        "coords": {
            "OVERLAY_ADD_CODE": (540, 2009),
            "MANUAL_BUTTON": (372, 2061),
            "INPUT_BOX": (540, 825),
            "SUBMIT_BUTTON": (540, 1052),
            "ADD_NEW_CODE": (540, 1223),
            "PLAY_NOW": (298, 686),
            "SAFETY_OK": (880, 1310)
        }
    },
    "SM-G981U": {
        "name": "Samsung Galaxy S20 (SM-G981U)",
        "coords": {
            "OVERLAY_ADD_CODE": (720, 2726),
            "MANUAL_BUTTON": (496, 2816),
            "INPUT_BOX": (720, 955),
            "SUBMIT_BUTTON": (720, 1255),
            "ADD_NEW_CODE": (720, 1450),
            "PLAY_NOW": (390, 850),
            "SAFETY_OK": (1170, 1790)
        }
    },
    "SM-G955W": {
        "name": "Samsung Galaxy S8+ (SM-G955W)",
        "coords": {
            "OVERLAY_ADD_CODE": (540, 1899),
            "MANUAL_BUTTON": (372, 1954),
            "INPUT_BOX": (540, 725),
            "SUBMIT_BUTTON": (540, 935),
            "ADD_NEW_CODE": (540, 1100),
            "PLAY_NOW": (295, 620),
            "SAFETY_OK": (880, 1240)
        }
    }
}

DEFAULT_PROFILE = DEVICE_PROFILES["SM-S911W"]

class AdbEntryManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AdbEntryManager, cls).__new__(cls)
            cls._instance.is_running = False
            cls._instance.stop_requested = threading.Event()
            cls._instance.worker_thread = None
            cls._instance.current_device = None
            cls._instance.current_code = None
            cls._instance.completed_count = 0
            cls._instance.total_count = 0
            cls._instance.status_message = "Idle"
            cls._instance.last_screenshot = None
        return cls._instance

    def get_device_profile(self, serial):
        """Resolves device profile dynamically via `adb shell getprop ro.product.model`."""
        try:
            model = self.run_adb(serial, ["shell", "getprop", "ro.product.model"]).strip()
            if model in DEVICE_PROFILES:
                return DEVICE_PROFILES[model]
        except Exception:
            pass
        return DEFAULT_PROFILE

    def list_devices(self):
        devices = []
        try:
            out = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=3).stdout
            for line in out.strip().split("\n")[1:]:
                parts = line.split()
                if len(parts) >= 2 and parts[1] == "device":
                    serial = parts[0]
                    profile = self.get_device_profile(serial)
                    devices.append({"serial": serial, "name": profile["name"]})
        except Exception as e:
            pass
        return devices

    def run_adb(self, serial, args, timeout=10):
        try:
            res = subprocess.run(["adb", "-s", serial] + args, capture_output=True, text=True, timeout=timeout)
            return res.stdout.strip()
        except Exception:
            return ""

    def check_app_installed(self, serial):
        """Checks whether the official McDonald's app package exists on device."""
        for pkg in ["com.mcdonalds.superapp", "ca.mcdonalds.app", "com.mcdonalds.app"]:
            path = self.run_adb(serial, ["shell", "pm", "path", pkg])
            if path and "package:" in path:
                return True, pkg
        return False, None

    def prompt_install_app(self, serial):
        """Attempts to open installed store (Aurora Store, Galaxy Store, or Play Store) directly to McDonald's."""
        # 1. Check for Aurora Store (FOSS Google Play client)
        aurora = self.run_adb(serial, ["shell", "pm", "path", "com.aurora.store"])
        if aurora and "package:" in aurora:
            self.run_adb(serial, ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "market://details?id=ca.mcdonalds.app", "com.aurora.store"])
            return "Opened Aurora Store on phone directly to McDonald's App"

        # 2. Check for Samsung Galaxy Store
        galaxy = self.run_adb(serial, ["shell", "pm", "path", "com.sec.android.app.samsungapps"])
        if galaxy and "package:" in galaxy:
            self.run_adb(serial, ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "samsungapps://ProductDetail/ca.mcdonalds.app"])
            return "Opened Samsung Galaxy Store on phone"

        # 3. Fallback to standard market intent
        self.run_adb(serial, ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "market://details?id=ca.mcdonalds.app"])
        return "Opened App Store on device"


    def get_screen_state(self, serial):
        self.run_adb(serial, ["shell", "uiautomator", "dump", "/sdcard/mcnopoly_state.xml"])
        self.run_adb(serial, ["pull", "/sdcard/mcnopoly_state.xml", "/tmp/mcnopoly_state.xml"])
        if not os.path.exists("/tmp/mcnopoly_state.xml"):
            return "UNKNOWN"
        try:
            with open("/tmp/mcnopoly_state.xml", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            # If the user clicked "Redeem via ADB" from Chrome/Browser on the phone itself:
            if 'package="com.android.chrome"' in content or 'package="org.mozilla.firefox"' in content or 'package="com.sec.android.app.sbrowser"' in content:
                return "IN_BROWSER"
            if "Do Not Text and Drive" in content or "Safety Warning" in content or "app while driving" in content:
                return "SAFETY_MODAL"
            elif "Enter Your Code" in content or "Enter the 14-digit code" in content or "Submit Code" in content:
                return "MANUAL_ENTRY"
            elif "Add Code Manually" in content or "Scan Your Code" in content:
                return "SCAN_CAMERA"
            elif "Add New Code" in content:
                return "ADD_NEW_CODE_SCREEN"
            elif "Property Collected!" in content or "You entered" in content:
                return "PROPERTY_COLLECTED"
            elif "Monopoly Golden Edition" in content or "Bonus Play" in content or "Peel Perks" in content:
                return "MONOPOLY_HUB"
            elif "Play Now" in content or "Get in the game!" in content:
                return "MAIN_HOME"
        except Exception:
            pass
        return "UNKNOWN"

    def ensure_manual_entry(self, serial, coords):
        installed, pkg = self.check_app_installed(serial)
        target_pkg = pkg or "com.mcdonalds.superapp"

        for _ in range(7):
            if self.stop_requested.is_set():
                return False
            state = self.get_screen_state(serial)
            if state == "MANUAL_ENTRY":
                return True
            elif state == "IN_BROWSER":
                self.status_message = "Switching from Browser to McDonald's App..."
                self.run_adb(serial, ["shell", "monkey", "-p", target_pkg, "-c", "android.intent.category.LAUNCHER", "1"])
                time.sleep(3.5)
            elif state == "SAFETY_MODAL":
                self.run_adb(serial, ["shell", "input", "tap", str(coords["SAFETY_OK"][0]), str(coords["SAFETY_OK"][1])])
                time.sleep(1.2)
            elif state == "SCAN_CAMERA":
                self.run_adb(serial, ["shell", "input", "tap", str(coords["MANUAL_BUTTON"][0]), str(coords["MANUAL_BUTTON"][1])])
                time.sleep(1.5)
            elif state == "ADD_NEW_CODE_SCREEN":
                self.run_adb(serial, ["shell", "input", "tap", str(coords["ADD_NEW_CODE"][0]), str(coords["ADD_NEW_CODE"][1])])
                time.sleep(1.5)
            elif state in ("PROPERTY_COLLECTED", "MONOPOLY_HUB"):
                self.run_adb(serial, ["shell", "input", "tap", str(coords["OVERLAY_ADD_CODE"][0]), str(coords["OVERLAY_ADD_CODE"][1])])
                time.sleep(1.5)
            elif state == "MAIN_HOME":
                self.run_adb(serial, ["shell", "input", "tap", str(coords["PLAY_NOW"][0]), str(coords["PLAY_NOW"][1])])
                time.sleep(2.5)
            else:
                self.run_adb(serial, ["shell", "input", "tap", str(coords["OVERLAY_ADD_CODE"][0]), str(coords["OVERLAY_ADD_CODE"][1])])
                time.sleep(1.2)
        return False

    def enter_single_code(self, serial, coords, code):
        ready = self.ensure_manual_entry(serial, coords)
        if not ready or self.stop_requested.is_set():
            return False

        # 1. Tap Input Box
        self.run_adb(serial, ["shell", "input", "tap", str(coords["INPUT_BOX"][0]), str(coords["INPUT_BOX"][1])])
        time.sleep(0.8)

        # 2. Type Code
        self.run_adb(serial, ["shell", "input", "text", code])
        time.sleep(0.8)

        if self.stop_requested.is_set():
            return False

        # 3. Tap Submit Button
        self.run_adb(serial, ["shell", "input", "tap", str(coords["SUBMIT_BUTTON"][0]), str(coords["SUBMIT_BUTTON"][1])])
        time.sleep(3.2)

        # 4. Capture screenshot
        log_dir = BASE_DIR / "media" / "entry_logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        img_name = f"adb_{serial}_{code}.png"
        img_path = log_dir / img_name

        self.run_adb(serial, ["shell", "screencap", "-p", "/sdcard/mcnopoly_res.png"])
        self.run_adb(serial, ["pull", "/sdcard/mcnopoly_res.png", str(img_path)])
        self.run_adb(serial, ["shell", "rm", "/sdcard/mcnopoly_res.png"])
        self.last_screenshot = f"/media/entry_logs/{img_name}"

        # 5. If code was already entered in the McDonald's App, the screen remains on MANUAL_ENTRY
        # with the rejected 14-char string still inside INPUT_BOX. Clear it so the next code starts fresh.
        post_state = self.get_screen_state(serial)
        if post_state == "MANUAL_ENTRY":
            self.run_adb(serial, ["shell", "input", "tap", str(coords["INPUT_BOX"][0]), str(coords["INPUT_BOX"][1])])
            time.sleep(0.3)
            self.run_adb(serial, ["shell", "input", "keyevent", "KEYCODE_MOVE_END"])
            self.run_adb(serial, ["shell", "input", "keyevent", "--longpress"] + ["KEYCODE_DEL"] * 18)
            time.sleep(0.4)

        return True

    def _worker(self, serial):
        from game.models import CollectedGamePiece

        self.is_running = True
        self.stop_requested.clear()
        self.status_message = "Starting ADB Redemption..."
        
        profile = self.get_device_profile(serial)
        coords = profile["coords"]
        self.current_device = profile["name"]

        unredeemed = list(CollectedGamePiece.objects.filter(is_redeemed=False))
        # Filter for valid 14-char codes
        valid_pieces = [p for p in unredeemed if p.code and len(p.code) == 14]

        self.total_count = len(valid_pieces)
        self.completed_count = 0

        if not valid_pieces:
            self.status_message = "No unredeemed 14-character codes found in database."
            self.is_running = False
            return

        for idx, piece in enumerate(valid_pieces, 1):
            if self.stop_requested.is_set():
                self.status_message = f"E-STOP: Halted at code {idx}/{len(valid_pieces)}"
                break

            self.current_code = piece.code
            self.status_message = f"Submitting {piece.code} ({piece.label_text})..."

            success = self.enter_single_code(serial, coords, piece.code)
            if success:
                piece.is_redeemed = True
                piece.save()
                self.completed_count += 1
                self.status_message = f"Redeemed {piece.code}! ({self.completed_count}/{self.total_count})"

                # Also write to local backup log
                tracker_file = BASE_DIR / "data" / "s23_entered_codes.txt"
                with open(tracker_file, "a") as f:
                    f.write(f"{piece.code} {piece.label_text}\n")

            time.sleep(1.5)

        if not self.stop_requested.is_set():
            self.status_message = f"Completed! Entered {self.completed_count} codes."
        self.is_running = False

    def start_redemption(self, serial=None):
        if self.is_running:
            return False, "Already running"

        devices = self.list_devices()
        if not devices:
            return False, "No ADB devices connected"

        if not serial:
            serial = devices[0]["serial"]

        # Preflight Check: Verify app is installed
        installed, pkg = self.check_app_installed(serial)
        if not installed:
            msg = self.prompt_install_app(serial)
            return False, f"McDonald's app not installed on {serial}. {msg}"

        self.worker_thread = threading.Thread(target=self._worker, args=(serial,), daemon=True)
        self.worker_thread.start()
        return True, f"Started redemption on {serial}"

    def estop(self):
        self.stop_requested.set()
        self.is_running = False
        self.status_message = "🛑 EMERGENCY STOP ACTIVATED"
        try:
            subprocess.run(["pkill", "-f", "uiautomator"], timeout=2)
        except Exception:
            pass
        return True

    def get_status(self):
        devices = self.list_devices()
        app_installed = False
        usb_mtp_only = False
        if devices:
            app_installed, _ = self.check_app_installed(devices[0]["serial"])
        else:
            try:
                lsusb_out = subprocess.run(["lsusb"], capture_output=True, text=True, timeout=2).stdout
                if any(vid in lsusb_out.lower() for vid in ("04e8:", "18d1:", "22b8:", "2717:")):
                    usb_mtp_only = True
            except Exception:
                pass

        queued_count = 0
        try:
            from game.models import CollectedGamePiece
            queued_count = sum(
                1 for p in CollectedGamePiece.objects.filter(is_redeemed=False)
                if p.code and len(p.code) == 14
            )
        except Exception:
            pass

        return {
            "is_running": self.is_running,
            "device": self.current_device,
            "current_code": self.current_code,
            "completed_count": self.completed_count,
            "total_count": self.total_count,
            "queued_count": queued_count,
            "message": self.status_message,
            "last_screenshot": self.last_screenshot,
            "devices": devices,
            "app_installed": app_installed,
            "usb_mtp_only": usb_mtp_only,
        }

adb_manager = AdbEntryManager()

