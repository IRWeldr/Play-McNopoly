#!/usr/bin/env python3
"""
McDonald's Monopoly Code Automated Entry for Samsung Galaxy S20 (SM-G981U)
Screen Resolution: 1440 x 3200 (640 dpi)
"""

import subprocess
import time
import json
import sys
import os
import glob

TARGET_SERIAL = "RFCN208AQQE"  # Samsung Galaxy S20 5G (SM-G981U)
JSON_PATH = "./data/monopoly_codes.json"
SCREENSHOT_DIR = "./media/entry_logs/s20_entry_logs"
LOG_TRACKER = "./media/entry_logs/s20_entered_codes.txt"

# Exact Calibrated Coordinates for Samsung Galaxy S20 (1440x3200)
# Derived directly from live UI dumps (uiautomator dump):
BTN_OVERLAY_ADD_CODE = (720, 2726)  # Floating '+ Add Code' banner [508, 2548][932, 2904]
BTN_MANUAL = (496, 2816)            # 'Add Code Manually' button [80, 2728][912, 2904]
INPUT_BOX = (720, 955)              # 14-digit text box [67, 886][1372, 1025]
BTN_SUBMIT = (720, 1255)            # 'Submit Code' button [160, 1155][1280, 1355]
BTN_ADD_NEW_CODE = (720, 1450)      # 'Add New Code' button after duplicate/result
BTN_PLAY_NOW = (390, 850)           # 'Play Now' if ever on Home Screen
BTN_SAFETY_OK = (1170, 1790)        # 'OK' button on safety modal if shown
BTN_CLOSE_X = (136, 200)            # Top-left back navigation arrow [40, 104][232, 296]

def run_adb(args):
    res = subprocess.run(["adb", "-s", TARGET_SERIAL] + args, capture_output=True, text=True)
    return res.stdout.strip()

def check_device():
    out = subprocess.run(["adb", "devices"], capture_output=True, text=True).stdout
    if TARGET_SERIAL not in out:
        print(f"Error: Target Galaxy S20 ({TARGET_SERIAL}) is not detected in 'adb devices'.")
        return False
    return True

def get_screen_state():
    """Inspects the active screen UI on the S20 to determine exact state."""
    run_adb(["shell", "uiautomator", "dump", "/sdcard/s20_state.xml"])
    run_adb(["pull", "/sdcard/s20_state.xml", "/tmp/s20_state.xml"])
    
    if not os.path.exists("/tmp/s20_state.xml"):
        return "UNKNOWN"
        
    try:
        with open("/tmp/s20_state.xml", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        if "Do Not Text and Drive" in content or "Safety Warning" in content:
            return "SAFETY_MODAL"
        elif "Allow McDonald's to take pictures" in content:
            return "PERMISSION_CAMERA"
        elif "Enter Your Code" in content or "Enter the 14-digit code" in content:
            return "MANUAL_ENTRY"
        elif "Add Code Manually" in content or "Scan Your Code" in content:
            return "SCAN_CAMERA"
        elif "Add New Code" in content:
            return "ADD_NEW_CODE_SCREEN"
        elif "Property Collected!" in content or "You entered" in content:
            return "PROPERTY_COLLECTED"
        elif "Monopoly Golden Edition" in content or "Bonus Play" in content or "Peel Perks" in content:
            return "MONOPOLY_HUB"
        elif "Play Now" in content or "Get in the game!" in content or "Rewards&Offers" in content:
            return "MAIN_HOME"
    except Exception:
        pass
    return "UNKNOWN"

def ensure_manual_entry():
    """Reliably navigates the S20 to the manual entry screen without exiting Monopoly."""
    for attempt in range(8):
        state = get_screen_state()
        
        if state == "MANUAL_ENTRY":
            return True
        elif state == "PERMISSION_CAMERA":
            print("  Granting camera permission...")
            run_adb(["shell", "input", "tap", "720", "2360"])
            time.sleep(1.5)
        elif state == "SAFETY_MODAL":
            print("  Dismissing safety modal...")
            run_adb(["shell", "input", "tap", str(BTN_SAFETY_OK[0]), str(BTN_SAFETY_OK[1])])
            time.sleep(1.5)
        elif state == "SCAN_CAMERA":
            run_adb(["shell", "input", "tap", str(BTN_MANUAL[0]), str(BTN_MANUAL[1])])
            time.sleep(1.8)
        elif state == "ADD_NEW_CODE_SCREEN":
            run_adb(["shell", "input", "tap", str(BTN_ADD_NEW_CODE[0]), str(BTN_ADD_NEW_CODE[1])])
            time.sleep(1.8)
        elif state in ("PROPERTY_COLLECTED", "MONOPOLY_HUB"):
            run_adb(["shell", "input", "tap", str(BTN_OVERLAY_ADD_CODE[0]), str(BTN_OVERLAY_ADD_CODE[1])])
            time.sleep(1.8)
        elif state == "MAIN_HOME":
            run_adb(["shell", "input", "tap", str(BTN_PLAY_NOW[0]), str(BTN_PLAY_NOW[1])])
            time.sleep(3.0)
        else:
            # Fallback tap Add Code overlay
            run_adb(["shell", "input", "tap", str(BTN_OVERLAY_ADD_CODE[0]), str(BTN_OVERLAY_ADD_CODE[1])])
            time.sleep(1.5)
            
    return False

def get_already_entered():
    entered = set()
    # Read all trackers across devices to avoid entering duplicate codes on the account
    trackers = [
        LOG_TRACKER,
        "./media/entry_logs/s23_entered_codes.txt",
        "./media/entry_logs/entered_codes.txt"
    ]
    for trk in trackers:
        if os.path.exists(trk):
            with open(trk) as f:
                for line in f:
                    c = line.strip().split()
                    if c and len(c[0]) == 14:
                        entered.add(c[0])

    # Check all captured screenshot folders
    for log_dir in [SCREENSHOT_DIR, "./media/entry_logs/s23_entry_logs", "./media/entry_logs/entry_logs"]:
        if os.path.exists(log_dir):
            for img in glob.glob(os.path.join(log_dir, "*.png")):
                base = os.path.basename(img).replace(".png", "")
                parts = base.split("_")
                if len(parts) >= 2 and len(parts[1]) == 14:
                    entered.add(parts[1])

    return entered

def enter_code(code, property_name, index, total):
    print(f"\n[{index}/{total}] Submitting: {code} ({property_name})")
    
    ready = ensure_manual_entry()
    if not ready:
        print("  ⚠️ Warning: Could not confirm MANUAL_ENTRY screen. Attempting tap anyway.")
    
    # 1. Tap input box
    run_adb(["shell", "input", "tap", str(INPUT_BOX[0]), str(INPUT_BOX[1])])
    time.sleep(0.8)
    
    # 2. Type code
    run_adb(["shell", "input", "text", code])
    time.sleep(1.0)
    
    # 3. Tap Submit Code
    run_adb(["shell", "input", "tap", str(BTN_SUBMIT[0]), str(BTN_SUBMIT[1])])
    time.sleep(3.5)
    
    # 4. Capture result screenshot
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    log_img = os.path.join(SCREENSHOT_DIR, f"{index:03d}_{code}.png")
    run_adb(["shell", "screencap", "-p", "/sdcard/s20_res.png"])
    run_adb(["pull", "/sdcard/s20_res.png", log_img])
    run_adb(["shell", "rm", "/sdcard/s20_res.png"])
    print(f"  -> Captured confirmation: {log_img}")
    
    # Record in S20 tracker
    with open(LOG_TRACKER, "a") as f:
        f.write(f"{code} {property_name}\n")
        
    time.sleep(1.0)

def main():
    if not check_device():
        sys.exit(1)
        
    print(f"Connected to Target Device: Samsung Galaxy S20 ({TARGET_SERIAL})")
    
    with open(JSON_PATH) as f:
        data = json.load(f)
        
    all_codes = data.get("unique_codes", [])
    already_entered = get_already_entered()
    
    # Filter to valid 14-character codes that have not yet been submitted anywhere
    codes_to_enter = [c for c in all_codes if len(c.get("code", "")) == 14 and c.get("code") not in already_entered]
    
    print(f"Total verified unique codes: {len([c for c in all_codes if len(c.get('code','')) == 14])}")
    print(f"Already entered across devices: {len(already_entered)}")
    print(f"Remaining codes to enter:        {len(codes_to_enter)}")
    
    if not codes_to_enter:
        print("All codes have already been entered across all devices!")
        return

    print("\nStarting batch entry on Samsung Galaxy S20...")
    for idx, item in enumerate(codes_to_enter, 1):
        enter_code(item["code"], item.get("property", "Unknown"), idx, len(codes_to_enter))
        time.sleep(1.5)

    print("\nBatch entry completed successfully on Galaxy S20!")

if __name__ == "__main__":
    main()
