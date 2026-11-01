#!/usr/bin/env python3
"""
automation/cli_runner.py - Unified Multi-Device ADB CLI Runner
Executes batch McDonald's Monopoly code entry on connected Android devices.
Merges capabilities from S23, S20, S8+, and Page 5 standalone scripts into one unified tool.
"""

import argparse
import sys
import os
import time
import json
import glob
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from automation.adb_manager import adb_manager, DEVICE_PROFILES

def get_already_entered_codes():
    """Aggregates all previously submitted codes across device logs and screenshots."""
    entered = set()
    log_dir = PROJECT_ROOT / "data"
    for log_file in log_dir.glob("*_entered_codes.txt"):
        with open(log_file, "r", errors="ignore") as f:
            for line in f:
                parts = line.strip().split()
                if parts and len(parts[0]) == 14:
                    entered.add(parts[0])

    screenshot_dir = PROJECT_ROOT / "media" / "entry_logs"
    if screenshot_dir.exists():
        for img in screenshot_dir.glob("*.png"):
            # Extract 14-character token from filename
            name = img.stem
            for chunk in name.split("_"):
                if len(chunk) == 14 and chunk.isalnum():
                    entered.add(chunk)

    return entered

def load_target_codes(json_path=None):
    """Loads codes from database or specified JSON file."""
    if json_path and os.path.exists(json_path):
        with open(json_path, "r", errors="ignore") as f:
            data = json.load(f)
            if "pieces" in data:
                return [{"code": p["code"], "property": p.get("property", "Unknown")} for p in data["pieces"] if p.get("code")]
            elif "unique_codes" in data:
                return [{"code": c["code"], "property": c.get("property", "Unknown")} for c in data["unique_codes"] if c.get("code")]

    # Default: Load from Django database
    try:
        import django
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mcnopoly_core.settings")
        django.setup()
        from game.models import CollectedGamePiece

        unredeemed = CollectedGamePiece.objects.filter(is_redeemed=False)
        return [{"code": p.code, "property": p.label_text, "obj": p} for p in unredeemed if p.code and len(p.code) == 14]
    except Exception as e:
        print(f"Warning: Could not connect to Django database ({e}). Falling back to data/monopoly_codes.json")
        fallback_json = PROJECT_ROOT / "data" / "monopoly_codes.json"
        if fallback_json.exists():
            return load_target_codes(str(fallback_json))
        return []

def main():
    parser = argparse.ArgumentParser(description="Unified McDonald's Monopoly ADB Automation Runner")
    parser.add_argument("--device", choices=["s23", "s20", "s8", "auto"], default="auto", help="Target device profile")
    parser.add_argument("--serial", default=None, help="Specific ADB device serial number")
    parser.add_argument("--codes", default=None, help="Optional path to custom codes JSON file")
    parser.add_argument("--limit", type=int, default=100, help="Max codes to enter this run (Default: 100 daily cap)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without submitting")
    args = parser.parse_args()

    print("\n=======================================================")
    print("🎩 Play-McNopoly Unified ADB Automation Runner")
    print("=======================================================\n")

    # 1. Device Discovery
    devices = adb_manager.list_devices()
    if not devices:
        print("❌ Error: No Android devices detected via ADB.")
        print("Please connect your phone via USB with 'USB Debugging' enabled.")
        sys.exit(1)

    target_serial = args.serial
    if not target_serial:
        target_serial = devices[0]["serial"]

    profile = adb_manager.get_device_profile(target_serial)

    # 2. Preflight Package Installation Check
    installed, pkg = adb_manager.check_app_installed(target_serial)
    if not installed:
        print(f"\n⚠️  NOTICE: McDonald's app is NOT installed on {profile['name']} [{target_serial}].")
        msg = adb_manager.prompt_install_app(target_serial)
        print(f"👉 Action: {msg}")
        print("\nPlease finish installing and launching the McDonald's App on your device, then re-run this command.")
        sys.exit(0)

    # 3. Load and Deduplicate Codes
    all_codes = load_target_codes(args.codes)
    already_entered = get_already_entered_codes()

    queue = [c for c in all_codes if len(c["code"]) == 14 and c["code"] not in already_entered]
    queue = queue[:args.limit]

    print(f"📋 Total Unredeemed : {len(all_codes)}")
    print(f"🛑 Already Entered  : {len(already_entered)}")
    print(f"🚀 Queued for Entry : {len(queue)} (Limit: {args.limit})")

    if not queue:
        print("\n🎉 All available codes have already been entered!")
        return

    if args.dry_run:
        print("\n[DRY RUN] Would submit the following codes:")
        for idx, item in enumerate(queue, 1):
            print(f"  {idx:02d}. {item['code']} - {item['property']}")
        return

    print("\nStarting automated entry on device...")
    coords = profile["coords"]

    for idx, item in enumerate(queue, 1):
        code = item["code"]
        prop = item["property"]
        print(f"\n[{idx}/{len(queue)}] Submitting: {code} ({prop})...")

        success = adb_manager.enter_single_code(target_serial, coords, code)
        if success:
            print(f"  ✅ Captured confirmation screenshot: {adb_manager.last_screenshot}")
            
            # Update database if piece object exists
            if "obj" in item:
                item["obj"].is_redeemed = True
                item["obj"].save()

            # Record in device tracker
            tracker_file = PROJECT_ROOT / "data" / f"{args.device}_entered_codes.txt"
            with open(tracker_file, "a") as f:
                f.write(f"{code} {prop}\n")
        else:
            print("  ⚠️ Submission failed or screen state timed out.")

        time.sleep(1.5)

    print("\n=======================================================")
    print(f"🎉 Batch entry complete! Entered {len(queue)} codes.")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
