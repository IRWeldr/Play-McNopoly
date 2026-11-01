#!/usr/bin/env python3
"""
Automated Entry for Monopoly-Game Pieces-5.png on Samsung Galaxy S23 (SM-S911W)
Target Codes File: ./data/monopoly_codes_page5.json
"""

import subprocess
import time
import json
import sys
import os
import glob

TARGET_SERIAL = os.environ.get("ADB_SERIAL") or (
    subprocess.run(["adb", "get-serialno"], capture_output=True, text=True).stdout.strip()
    if subprocess.run(["adb", "devices"], capture_output=True, text=True).stdout.strip()
    else ""
)
JSON_PATH = "./data/monopoly_codes_page5.json"
SCREENSHOT_DIR = "./media/entry_logs/s23_entry_logs"
LOG_TRACKER = "./media/entry_logs/s23_entered_codes.txt"

# Exact Calibrated Coordinates for Samsung Galaxy S23 (1080x2340)
BTN_OVERLAY_ADD_CODE = (540, 2009)  # Center bottom floating '+ Add Code' banner
BTN_MANUAL = (372, 2061)            # 'Add Code Manually' button
INPUT_BOX = (540, 825)              # 14-digit text box
BTN_SUBMIT = (540, 1052)            # 'Submit Code' button
BTN_ADD_NEW_CODE = (540, 1223)      # 'Add New Code' button after duplicate/result
BTN_PLAY_NOW = (298, 686)           # 'Play Now' if ever on Home Screen
BTN_SAFETY_OK = (880, 1310)         # 'OK' button on safety modal

def run_adb(args):
    res = subprocess.run(["adb", "-s", TARGET_SERIAL] + args, capture_output=True, text=True)
    return res.stdout.strip()

def check_device():
    global TARGET_SERIAL
    out = subprocess.run(["adb", "devices"], capture_output=True, text=True).stdout
    if TARGET_SERIAL not in out:
        # Check if any single device is connected
        lines = [l for l in out.strip().split("\n")[1:] if l.strip() and "device" in l]
        if len(lines) == 1:
            detected_serial = lines[0].split()[0]
            print(f"Target {TARGET_SERIAL} not explicitly found, but detected device: {detected_serial}")
            TARGET_SERIAL = detected_serial
            return True
        print(f"Error: Galaxy S23 ({TARGET_SERIAL}) is not detected in 'adb devices'.")
        print("Please connect the device via USB with USB Debugging enabled.")
        return False
    return True

def get_screen_state():
    run_adb(["shell", "uiautomator", "dump", "/sdcard/s23_state.xml"])
    run_adb(["pull", "/sdcard/s23_state.xml", "/tmp/s23_state.xml"])
    if not os.path.exists("/tmp/s23_state.xml"):
        return "UNKNOWN"
    try:
        with open("/tmp/s23_state.xml", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        if "Do Not Text and Drive" in content or "Safety Warning" in content:
            return "SAFETY_MODAL"
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
    for attempt in range(8):
        state = get_screen_state()
        if state == "MANUAL_ENTRY":
            return True
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
            run_adb(["shell", "input", "tap", str(BTN_OVERLAY_ADD_CODE[0]), str(BTN_OVERLAY_ADD_CODE[1])])
            time.sleep(1.5)
    return False

def get_already_entered():
    entered = set()
    for trk in [
        LOG_TRACKER,
        "./media/entry_logs/s20_entered_codes.txt",
        "./media/entry_logs/entered_codes.txt"
    ]:
        if os.path.exists(trk):
            with open(trk) as f:
                for line in f:
                    c = line.strip().split()
                    if c and len(c[0]) == 14:
                        entered.add(c[0])
    for log_dir in [SCREENSHOT_DIR, "./media/entry_logs/s20_entry_logs", "./media/entry_logs/entry_logs"]:
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
    log_img = os.path.join(SCREENSHOT_DIR, f"p5_{index:02d}_{code}.png")
    run_adb(["shell", "screencap", "-p", "/sdcard/p5_res.png"])
    run_adb(["pull", "/sdcard/p5_res.png", log_img])
    run_adb(["shell", "rm", "/sdcard/p5_res.png"])
    print(f"  -> Captured confirmation: {log_img}")
    
    # Record in S23 tracker
    with open(LOG_TRACKER, "a") as f:
        f.write(f"{code} {property_name}\n")
    time.sleep(1.0)

def main():
    if not check_device():
        sys.exit(1)
        
    print(f"Connected to Device: {TARGET_SERIAL}")
    with open(JSON_PATH) as f:
        data = json.load(f)
        
    all_pieces = data.get("pieces", [])
    already_entered = get_already_entered()
    
    codes_to_enter = [p for p in all_pieces if len(p.get("code", "")) == 14 and p.get("code") not in already_entered]
    
    print(f"Total Page 5 extracted pieces: {len(all_pieces)}")
    print(f"Fresh codes to enter:         {len(codes_to_enter)}")
    
    if not codes_to_enter:
        print("All codes have already been claimed!")
        return

    print("\nStarting automated entry on Samsung Galaxy S23...")
    for idx, item in enumerate(codes_to_enter, 1):
        enter_code(item["code"], item.get("property", "Unknown"), idx, len(codes_to_enter))
        time.sleep(1.5)

    print("\nBatch entry for Page 5 completed successfully!")

if __name__ == "__main__":
    main()
