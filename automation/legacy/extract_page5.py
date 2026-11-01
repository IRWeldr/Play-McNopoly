#!/usr/bin/env python3
import urllib.request
import json
import base64
import os
import glob
import re
import time
import numpy as np
from PIL import Image
from scipy import ndimage

API_URL = "http://localhost:1234/v1/chat/completions"
MODEL_NAME = "qwen3-vl-8b-instruct"
IMAGE_PATH = "./dataset/page-5.png"
OUTPUT_JSON = "./data/monopoly_codes_page5.json"
CROPS_DIR = "/tmp/page5_perfect_crops"

def segment_pieces():
    print(f"Loading {IMAGE_PATH}...")
    img = Image.open(IMAGE_PATH)
    w_orig, h_orig = img.size
    
    scale_factor = 2
    small = img.resize((w_orig // scale_factor, h_orig // scale_factor), Image.Resampling.BOX)
    gray = np.array(small.convert("L"))
    mask = (gray < 232)

    struct = ndimage.generate_binary_structure(2, 2)
    closed = ndimage.binary_closing(mask, structure=struct, iterations=7)
    closed = ndimage.binary_fill_holes(closed)

    labeled, _ = ndimage.label(closed)
    slices = ndimage.find_objects(labeled)

    os.makedirs(CROPS_DIR, exist_ok=True)
    piece_id = 1

    for s in slices:
        y_slice, x_slice = s
        bw = (x_slice.stop - x_slice.start) * scale_factor
        bh = (y_slice.stop - y_slice.start) * scale_factor
        area = bw * bh
        
        if area > 40000 and bw > 140 and bh > 140:
            pad = 45
            x1 = max(0, x_slice.start * scale_factor - pad)
            x2 = min(w_orig, x_slice.stop * scale_factor + pad)
            y1 = max(0, y_slice.start * scale_factor - pad)
            y2 = min(h_orig, y_slice.stop * scale_factor + pad)
            
            piece_crop = img.crop((x1, y1, x2, y2))
            
            # If large merged blob containing 2 pieces (Crop 10)
            if area > 250000:
                pw, ph = piece_crop.size
                top_half = piece_crop.crop((0, 0, pw, int(ph * 0.65)))
                bot_half = piece_crop.crop((0, int(ph * 0.35), pw, ph))
                
                top_half.save(f"{CROPS_DIR}/piece_{piece_id:02d}.jpg", quality=95)
                piece_id += 1
                bot_half.save(f"{CROPS_DIR}/piece_{piece_id:02d}.jpg", quality=95)
                piece_id += 1
            else:
                piece_crop.save(f"{CROPS_DIR}/piece_{piece_id:02d}.jpg", quality=95)
                piece_id += 1

    print(f"Segmented {piece_id - 1} pieces into {CROPS_DIR}.")
    return sorted(glob.glob(f"{CROPS_DIR}/*.jpg"))

def transcribe_piece(pfile):
    fname = os.path.basename(pfile)
    with open(pfile, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
        
    prompt = """Examine this McDonald's Monopoly game piece sticker.
It may be rotated at an angle or upside down.
Read the text and transcribe:
1. Property Name & Number (e.g. Niagara Falls #822, Baffin Island #813, Signal Hill #809, etc.)
2. The 14-character alphanumeric code printed on the sticker (letters and numbers only). Be very precise with each character.

Return ONLY valid JSON in this exact structure:
{
  "property": "<Property Name & #>",
  "code": "<14-character code>"
}"""

    req_data = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
                ]
            }
        ],
        "temperature": 0.0,
        "max_tokens": 70
    }
    req = urllib.request.Request(
        API_URL,
        headers={"Content-Type": "application/json"},
        data=json.dumps(req_data).encode("utf-8")
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        txt = data["choices"][0]["message"]["content"].strip()
        txt = re.sub(r"^```json\s*", "", txt)
        txt = re.sub(r"^```\s*", "", txt)
        txt = re.sub(r"\s*```$", "", txt)
        
        item = json.loads(txt)
        clean_code = re.sub(r"[^A-Z0-9]", "", str(item.get("code", "")).upper())
        item["code"] = clean_code
        item["file"] = fname
        item["valid_14"] = (len(clean_code) == 14)
        return item

def main():
    piece_files = segment_pieces()
    print(f"\nTranscribing {len(piece_files)} game pieces using {MODEL_NAME}...\n")
    
    results = []
    start_t = time.time()
    
    for idx, pfile in enumerate(piece_files, 1):
        try:
            item = transcribe_piece(pfile)
            results.append(item)
            c = item["code"]
            p = item.get("property", "Unknown")
            print(f"[{idx:02d}/{len(piece_files)}] {pfile.split('/')[-1]}: {p} -> {c} (length {len(c)})")
        except Exception as e:
            print(f"[{idx:02d}/{len(piece_files)}] {pfile.split('/')[-1]} Error: {e}")
            
    with open(OUTPUT_JSON, "w") as f:
        json.dump({"page": 5, "total_pieces": len(results), "pieces": results}, f, indent=2)
        
    print(f"\nExtraction complete in {time.time() - start_t:.1f}s.")
    print(f"Results saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
