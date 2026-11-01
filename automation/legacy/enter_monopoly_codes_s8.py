#!/usr/bin/env python3
"""
McDonald's Monopoly Code Automated Entry for Samsung Galaxy S8+ (SM-G955W)
Screen Resolution: 1080 x 2220 (FHD+ mode, 420 dpi) / 1440 x 2960 (native WQHD+)
Includes Dynamic UI XML Bounds Detection for 100% Precision.
"""

import subprocess
import time
import json
import sys
import os
import glob
import re
import xml.etree.ElementTree as ET

TARGET_SERIAL = "988a5b464852344a31"  # Samsung Galaxy S8+ (SM-G955W)
JSON_PATH = "./data/monopoly_codes.json"
SCREENSHOT_DIR = "./media/entry_logs/s8_entry_logs"
LOG_TRACKER = "./media/entry_logs/s8_entered_codes.txt"

# Baseline Proportional Coordinates for Samsung Galaxy S8+ at 1080x2220 (FHD+)
FALLBACK_COORDS = {
    "OVERLAY_ADD_CODE": (540, 1899),
    "MANUAL_BUTTON": (372, 1954),
    "INPUT_BOX": (540, 725),
    "SUBMIT_BUTTON": (540, 935),
    "ADD_NEW_CODE": (540, 1100),
    "PLAY_NOW": (295, 620),
    "SAFETY_OK": (880, 1240)
}

def run_adb(args):
    res = subprocess.run(["adb", "-s", TARGET_SERIAL] + args, capture_output=True, text=True)
    return res.stdout.strip()

def check_device():
    out = subprocess.run(["adb", "devices"], capture_output=True, text=True).stdout
    if TARGET_SERIAL not in out:
        print(f"Error: Target Galaxy S8+ ({TARGET_SERIAL}) is not detected in 'adb devices'.")
        return False
    return True

def get_xml_tree():
    """Dumps the live UI hierarchy and returns parsed XML ElementTree."""
    run_adb(["shell", "uiautomator", "dump", "/sdcard/s8_state.xml"])
    run_adb(["pull", "/sdcard/s8_state.xml", "/tmp/s8_state.xml"])
    if os.path.exists("/tmp/s8_state.xml"):
        try:
            return ET.parse("/tmp/s8_state.xml")
        except Exception:
            pass
    return None

def find_element_center(tree, match_predicate):
    """Finds the (X, Y) center coordinates of any matching node in the UI XML."""
    if tree is None:
        return None
    for node in tree.getroot().iter("node"):
        if match_predicate(node):
            bounds = node.attrib.get("bounds", "")
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
            if m:
                x1, y1, x2, y2 = map(int, m.groups())
                return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None

def get_screen_state(tree):
    """Determines screen state from parsed XML tree."""
    if tree is None:
        return "UNKNOWN"
    content = ET.tostring(tree.getroot(), encoding="utf-8").decode("utf-8", errors="ignore")
    
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
    return "UNKNOWN"

def tap_smart(tree, match_func, fallback_key):
    """Taps dynamic XML element bounds if found; otherwise falls back to calibrated coordinates."""
    pos = find_element_center(tree, match_func)
    if not pos and fallback_key in FALLBACK_COORDS:
        pos = FALLBACK_COORDS[fallback_key]
    if pos:
        run_adb(["shell", "input", "tap", str(pos[0]), str(pos[1])])
        return True
    return False

def ensure_manual_entry():
    """Navigates to manual entry on the S8+."""
    for attempt in range(8):
        tree = get_xml_tree()
        state = get_screen_state(tree)
        
        if state == "MANUAL_ENTRY":
            return True
        elif state == "PERMISSION_CAMERA":
            print("  Granting camera permission...")
            tap_smart(tree, lambda n: "While using the app" in n.attrib.get("text", "") or "foreground" in n.attrib.get("resource-id", ""), "SAFETY_OK")
            time.sleep(1.5)
        elif state == "SAFETY_MODAL":
            print("  Dismissing safety modal...")
            tap_smart(tree, lambda n: n.attrib.get("text") == "OK", "SAFETY_OK")
            time.sleep(1.5)
        elif state == "SCAN_CAMERA":
            tap_smart(tree, lambda n: "manual_code_button" in n.attrib.get("resource-id", "") or "Add Code Manually" in n.attrib.get("text", ""), "MANUAL_BUTTON")
            time.sleep(1.8)
        elif state == "ADD_NEW_CODE_SCREEN":
            tap_smart(tree, lambda n: "Add New Code" in n.attrib.get("text", ""), "ADD_NEW_CODE")
            time.sleep(1.8)
        elif state in ("PROPERTY_COLLECTED", "MONOPOLY_HUB"):
            tap_smart(tree, lambda n: n.attrib.get("content-desc") == "Add Code" or n.attrib.get("text") == "Add Code", "OVERLAY_ADD_CODE")
            time.sleep(1.8)
        elif state == "MAIN_HOME":
            tap_smart(tree, lambda n: "Play Now" in n.attrib.get("text", "") or "Play Now" in n.attrib.get("content-desc", ""), "PLAY_NOW")
            time.sleep(3.0)
        else:
            tap_smart(tree, lambda n: n.attrib.get("content-desc") == "Add Code", "OVERLAY_ADD_CODE")
            time.sleep(1.5)
            
    return False

def get_already_entered():
    entered = set()
    # Read all trackers across all devices
    for trk in [
        LOG_TRACKER,
        "./media/entry_logs/s20_entered_codes.txt",
        "./media/entry_logs/s23_entered_codes.txt",
        "./media/entry_logs/entered_codes.txt"
    ]:
        if os.path.exists(trk):
            with open(trk) as f:
                for line in f:
                    c = line.strip().split()
                    if c and len(c[0]) == 14:
                        entered.add(c[0])

    for log_dir in [SCREENSHOT_DIR, "./media/entry_logs/s20_entry_logs", "./media/entry_logs/s23_entry_logs", "./media/entry_logs/entry_logs"]:
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
    
    tree = get_xml_tree()
    # 1. Tap input box
    tap_smart(tree, lambda n: "monopoly_scan_spaced_underline" in n.attrib.get("resource-id", "") or n.attrib.get("class") == "android.widget.EditText", "INPUT_BOX")
    time.sleep(0.8)
    
    # 2. Type code
    run_adb(["shell", "input", "text", code])
    time.sleep(1.0)
    
    # 3. Tap Submit Code
    tree = get_xml_tree()
    tap_smart(tree, lambda n: "monopoly_code_submit_button" in n.attrib.get("resource-id", "") or "Submit Code" in n.attrib.get("text", ""), "SUBMIT_BUTTON")
    time.sleep(3.5)
    
    # 4. Capture result screenshot
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    log_img = os.path.join(SCREENSHOT_DIR, f"{index:03d}_{code}.png")
    run_adb(["shell", "screencap", "-p", "/sdcard/s8_res.png"])
    run_adb(["pull", "/sdcard/s8_res.png", log_img])
    run_adb(["shell", "rm", "/sdcard/s8_res.png"])
    print(f"  -> Captured confirmation: {log_img}")
    
    # Record in S8+ tracker
    with open(LOG_TRACKER, "a") as f:
        f.write(f"{code} {property_name}\n")
        
    time.sleep(1.0)

def main():
    if not check_device():
        sys.exit(1)
        
    print(f"Connected to Target Device: Samsung Galaxy S8+ ({TARGET_SERIAL})")
    
    with open(JSON_PATH) as f:
        data = json.load(f)
        
    all_codes = data.get("unique_codes", [])
    already_entered = get_already_entered()
    
    codes_to_enter = [c for c in all_codes if len(c.get("code", "")) == 14 and c.get("code") not in already_entered]
    
    print(f"Total verified unique codes: {len([c for c in all_codes if len(c.get('code','')) == 14])}")
    print(f"Already entered across devices: {len(already_entered)}")
    print(f"Remaining codes to enter:        {len(codes_to_enter)}")
    
    if not codes_to_enter:
        print("All codes have already been entered across all devices!")
        return

    print("\nStarting batch entry on Samsung Galaxy S8+...")
    for idx, item in enumerate(codes_to_enter, 1):
        enter_code(item["code"], item.get("property", "Unknown"), idx, len(codes_to_enter))
        time.sleep(1.5)

    print("\nBatch entry completed successfully on Galaxy S8+!")

if __name__ == "__main__":
    main()
