#!/usr/bin/env python3
"""
benchmark.py - Multi-Model Vision Evaluation & Extraction Engine
Evaluates local or remote vision models against the McDonald's Monopoly Benchmark Dataset.
Supports: LM Studio (Qwen3-VL), Ollama (Llama-3.2-Vision), and custom OpenAI endpoints.
"""

import argparse
import base64
import json
import time
import os
import re
from pathlib import Path
import urllib.request
import urllib.error
import numpy as np
from PIL import Image
from scipy.ndimage import binary_closing, label, find_objects

DEFAULT_LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"
DEFAULT_OLLAMA_URL = "http://localhost:11434/api/generate"

def segment_unstructured_image(image_path, min_area=15000):
    """
    Morphological segmentation for scattered in-the-wild stickers (Page 5).
    """
    img = Image.open(image_path).convert("RGB")
    arr = np.array(img)
    # Background thresholding (light sticker body vs dark table/scanner bed)
    gray = np.mean(arr, axis=2)
    mask = gray > 45
    closed = binary_closing(mask, structure=np.ones((12, 12)))
    lbl, num_features = label(closed)
    slices = find_objects(lbl)
    
    crops = []
    w, h = img.size
    for idx, slc in enumerate(slices):
        ymin, ymax = slc[0].start, slc[0].stop
        xmin, xmax = slc[1].start, slc[1].stop
        area = (ymax - ymin) * (xmax - xmin)
        if area >= min_area:
            # Add padding
            pad = 25
            ymin_p = max(0, ymin - pad)
            ymax_p = min(h, ymax + pad)
            xmin_p = max(0, xmin - pad)
            xmax_p = min(w, xmax + pad)
            cropped = img.crop((xmin_p, ymin_p, xmax_p, ymax_p))
            crops.append({
                "index": len(crops) + 1,
                "bbox": [xmin_p, ymin_p, xmax_p, ymax_p],
                "image": cropped
            })
    return crops

def query_vision_model(pil_image, model_name, api_url=DEFAULT_LM_STUDIO_URL, backend="lm_studio"):
    """
    Sends cropped image to selected vision model.
    """
    import io
    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=92)
    b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

    prompt = (
        "Look at this McDonald's Monopoly game piece sticker.\n"
        "1. Identify the property name and stamp number (e.g. Niagara Falls #822).\n"
        "2. Transcribe the exact alphanumeric code (14 characters printed on sticker).\n"
        "Output strictly JSON: {\"property\": \"<Name #Number>\", \"code\": \"<14-CHAR-CODE>\"}"
    )

    if backend == "lm_studio":
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                    ]
                }
            ],
            "temperature": 0.0,
            "max_tokens": 120
        }
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"]
                return parse_json_response(text)
        except Exception as e:
            return {"error": str(e)}

    elif backend == "ollama":
        payload = {
            "model": model_name,
            "prompt": prompt,
            "images": [b64_img],
            "stream": False
        }
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return parse_json_response(data.get("response", ""))
        except Exception as e:
            return {"error": str(e)}

    return {"error": "Unsupported backend"}

def parse_json_response(text):
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            code = re.sub(r'[^A-Z0-9]', '', str(parsed.get("code", "")).upper())
            parsed["code"] = code
            return parsed
        except Exception:
            pass
    return {"raw": text}

def main():
    parser = argparse.ArgumentParser(description="Evaluate vision models on McDonald's Monopoly benchmark datasets.")
    parser.add_argument("--input", default="dataset/page2.png", help="Path to input scan")
    parser.add_argument("--model", default="qwen3-vl-8b-instruct", help="Model name in backend")
    parser.add_argument("--backend", default="lm_studio", choices=["lm_studio", "ollama"], help="Vision inference backend")
    parser.add_argument("--url", default=None, help="Custom API completion endpoint URL")
    args = parser.parse_args()

    api_url = args.url or (DEFAULT_LM_STUDIO_URL if args.backend == "lm_studio" else DEFAULT_OLLAMA_URL)

    print(f"\n=======================================================")
    print(f"🍟 McDonald's Monopoly Vision Benchmark")
    print(f"Target Scan : {args.input}")
    print(f"Backend     : {args.backend} ({api_url})")
    print(f"Model       : {args.model}")
    print(f"=======================================================\n")

    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} not found.")
        return

    print("Step 1: Segmenting discrete game pieces from scan...")
    crops = segment_unstructured_image(args.input)
    print(f"-> Detected {len(crops)} sticker bounds.\n")

    print(f"Step 2: Transcribing stamps with {args.model}...")
    results = []
    t0 = time.time()
    for crop in crops:
        idx = crop["index"]
        print(f"  [{idx}/{len(crops)}] Processing sticker crop #{idx}...", end="", flush=True)
        res = query_vision_model(crop["image"], args.model, api_url=api_url, backend=args.backend)
        code = res.get("code", "ERROR")
        prop = res.get("property", "Unknown")
        print(f" -> Code: {code:14} | {prop}")
        results.append({
            "index": idx,
            "bbox": crop["bbox"],
            "property": prop,
            "code": code
        })

    elapsed = time.time() - t0
    valid_codes = [r for r in results if len(r.get("code", "")) == 14]

    print(f"\n=======================================================")
    print(f"Benchmark Complete in {elapsed:.2f}s ({elapsed/max(1,len(crops)):.2f}s/piece)")
    print(f"Total Pieces Segmented : {len(crops)}")
    print(f"Valid 14-Character Codes: {len(valid_codes)} / {len(crops)} ({(len(valid_codes)/max(1,len(crops)))*100:.1f}%)")
    print(f"=======================================================\n")

if __name__ == "__main__":
    main()
