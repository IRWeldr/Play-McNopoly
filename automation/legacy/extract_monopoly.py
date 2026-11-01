#!/usr/bin/env python3
import os
import sys
import re
import json
import time
import io
import base64
import concurrent.futures
import urllib.request
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # Allow large 1200 DPI images

OUTPUT_JSON = "./data/monopoly_codes.json"
API_URL = "http://localhost:1234/v1/chat/completions"
MODEL_NAME = "qwen3-vl-4b-instruct"

# Grid divider definitions calibrated to each page at 1275x1650 base
GRIDS = {
    1: {
        "cols": [0, 169, 339, 528, 691, 878, 1055],
        "rows": [0, 160, 324, 505, 686, 852, 1034, 1170, 1333, 1514]
    },
    2: {
        "cols": [0, 169, 339, 528, 691, 878, 1055],
        "rows": [0, 160, 324, 505, 689, 854, 1033, 1169, 1330, 1515]
    },
    3: {
        "cols": [0, 167, 340, 526, 692, 875, 1051, 1220],
        "rows": [0, 154, 323, 501, 688, 855, 1034, 1177, 1344, 1515]
    },
    4: {
        "cols": [0, 175, 338, 521, 692, 874, 1043, 1220],
        "rows": [0, 140, 300, 470, 640]
    }
}

PROMPT = """Read this McDonald's Monopoly game piece.
Return ONLY valid JSON in this exact structure:
{
  "property": "<Property Name & Number, e.g. Algonquin Provincial Park #815>",
  "prize": "<Prize description>",
  "code": "<Exact 10 to 14 character uppercase alphanumeric code at bottom>"
}"""

def call_qwen_vl(b64_img, max_retries=2):
    req_data = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                ]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 80
    }
    
    data_bytes = json.dumps(req_data).encode("utf-8")
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(
                API_URL,
                headers={"Content-Type": "application/json"},
                data=data_bytes
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                text = res["choices"][0]["message"]["content"].strip()
                
                # Clean markdown code blocks if wrapped
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                
                parsed = json.loads(text)
                return parsed
        except Exception as e:
            if attempt == max_retries:
                # Try fallback regex on raw text if json parsing failed
                try:
                    if 'res' in locals() and "choices" in res:
                        raw_text = res["choices"][0]["message"]["content"]
                        match = re.search(r'[A-Z0-9]{10,14}', raw_text)
                        code = match.group(0) if match else None
                        return {"property": "Unknown", "prize": "Unknown", "code": code, "raw": raw_text}
                except:
                    pass
                return {"error": str(e), "code": None}
            time.sleep(1.5)

def main():
    print(f"Starting McDonald's Monopoly extraction with {MODEL_NAME}...")
    cells_to_process = []
    
    # 1. Slice and validate all cells across all 4 pages
    for page_num in sorted(GRIDS.keys()):
        img_path = f"./dataset/page-{page_num}.png"
        if not os.path.exists(img_path):
            print(f"Warning: {img_path} not found.")
            continue
            
        print(f"Loading Page {page_num}...")
        img = Image.open(img_path)
        grid = GRIDS[page_num]
        col_divs = grid["cols"]
        row_divs = grid["rows"]
        scale = img.width / 1275.0
        
        page_cells = 0
        for r in range(len(row_divs) - 1):
            for c in range(len(col_divs) - 1):
                x1, x2 = int(col_divs[c] * scale), int(col_divs[c+1] * scale)
                y1, y2 = int(row_divs[r] * scale), int(row_divs[r+1] * scale)
                
                cell = img.crop((x1, y1, x2, y2))
                arr = np.array(cell.convert("L"))
                
                # Check for printed sticker contents
                if arr.std() > 15 and arr.min() < 180:
                    buf = io.BytesIO()
                    # Resize cell to standard high-clarity dimensions (~400px)
                    cell.thumbnail((500, 500), Image.Resampling.LANCZOS)
                    cell.convert("RGB").save(buf, format="JPEG", quality=90)
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                    
                    cells_to_process.append({
                        "page": page_num,
                        "row": r + 1,
                        "col": c + 1,
                        "b64": b64
                    })
                    page_cells += 1
        print(f"  -> Page {page_num}: queued {page_cells} stickers.")

    total_cells = len(cells_to_process)
    print(f"\nTotal stickers to extract: {total_cells}")
    print("Processing with 3 concurrent workers in LM Studio...\n")
    
    results = []
    start_time = time.time()
    
    def process_item(item):
        res = call_qwen_vl(item["b64"])
        code = res.get("code")
        # Ensure code is uppercase and valid length
        if code:
            clean_code = re.sub(r'[^A-Z0-9]', '', str(code).upper())
            res["code"] = clean_code
        else:
            res["code"] = None
            
        res["page"] = item["page"]
        res["grid_position"] = f"R{item['row']}C{item['col']}"
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        future_to_item = {executor.submit(process_item, item): item for item in cells_to_process}
        done_count = 0
        
        for future in concurrent.futures.as_completed(future_to_item):
            done_count += 1
            res = future.result()
            results.append(res)
            
            p = res.get("property", "Unknown")
            c = res.get("code", "NO_CODE")
            elapsed = time.time() - start_time
            rate = done_count / elapsed
            eta = (total_cells - done_count) / rate if rate > 0 else 0
            
            print(f"[{done_count}/{total_cells}] (Page {res['page']} {res['grid_position']}) {p} -> Code: {c} (ETA: {eta:.0f}s)")
            
            # Progressive save every 10 items
            if done_count % 10 == 0 or done_count == total_cells:
                save_data = {
                    "total_scanned_stickers": len(results),
                    "items": results
                }
                with open("/tmp/monopoly_interim.json", "w") as f:
                    json.dump(save_data, f, indent=2)

    # Compile final structured output
    unique_codes_map = {}
    invalid_or_missing = []
    
    for item in results:
        code = item.get("code")
        if code and len(code) >= 10:
            if code not in unique_codes_map:
                unique_codes_map[code] = {
                    "code": code,
                    "property": item.get("property"),
                    "prize": item.get("prize"),
                    "locations": [f"Page {item['page']} {item['grid_position']}"]
                }
            else:
                unique_codes_map[code]["locations"].append(f"Page {item['page']} {item['grid_position']}")
        else:
            invalid_or_missing.append(item)

    unique_list = sorted(unique_codes_map.values(), key=lambda x: (x.get("property") or "", x["code"]))
    
    final_output = {
        "final_summary": {
            "total_stickers_scanned": total_cells,
            "total_unique_codes": len(unique_codes_map),
            "duplicate_codes_count": sum(len(x["locations"]) - 1 for x in unique_codes_map.values()),
            "missing_or_unread_count": len(invalid_or_missing),
            "extraction_timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        },
        "unique_codes": unique_list,
        "all_scanned_pieces": results
    }
    
    with open(OUTPUT_JSON, "w") as f:
        json.dump(final_output, f, indent=2)
        
    print("\n" + "="*60)
    print("EXTRACTION COMPLETE!")
    print(f"Total Stickers Scanned: {total_cells}")
    print(f"Total Unique Codes:     {len(unique_codes_map)}")
    print(f"Duplicate Stickers:     {sum(len(x['locations']) - 1 for x in unique_codes_map.values())}")
    print(f"Output saved to:        {OUTPUT_JSON}")
    print("="*60)

if __name__ == "__main__":
    main()
