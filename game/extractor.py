import json
import urllib.request
import re
import base64
import colorsys
from typing import List, Dict, Any, Optional
from pathlib import Path
from PIL import Image

import os

API_URL = os.getenv("VISION_API_URL", "http://localhost:1234/v1/chat/completions")
VISION_MODEL = os.getenv("VISION_MODEL", "qwen3-vl-4b-instruct")
FALLBACK_VISION_MODELS = [
    VISION_MODEL,
    "qwen3-vl-4b-instruct",
    "qwen3-vl-8b-instruct",
    "qwen3-4b-vl",
    "qwen3-8b-vl",
]

# Color group to valid stamp numbers mapping for 2026 Canadian Golden Edition
STAMP_COLOR_MAP = {
    "brown": ["#801", "#802"],
    "cyan": ["#803", "#804", "#805"],
    "pink": ["#806", "#807", "#808"],
    "orange": ["#809", "#810", "#811"],
    "red": ["#812", "#813", "#814"],
    "yellow": ["#815", "#816", "#817"],
    "green": ["#818", "#819", "#820"],
    "darkblue": ["#821", "#822"],
    "railroad": ["#823", "#824", "#825", "#826"],
    "highway": ["#827", "#828"],
}

# Reverse lookup: stamp number to expected color group
COLOR_BY_STAMP = {}
for grp, stamps in STAMP_COLOR_MAP.items():
    for s in stamps:
        COLOR_BY_STAMP[s] = grp


def detect_color_bar_from_image(img: Image.Image) -> str:
    """
    Deterministic Computer Vision detector (<2ms).
    Samples the top 5% to 25% horizontal banner of a cropped game piece sticker
    and classifies the color family into Monopoly groups using HSV color space.
    """
    try:
        w, h = img.size
        # The color bar on Canadian Monopoly stamps occupies roughly the top 5% to 25%
        crop_box = (int(w * 0.1), int(h * 0.05), int(w * 0.9), int(h * 0.25))
        banner = img.crop(crop_box).convert("RGB")
        banner = banner.resize((40, 20), Image.Resampling.BOX)
        pixels = list(banner.getdata())

        # Collect saturated color candidates
        candidates = []
        for r, g, b in pixels:
            # Normalize to 0..1
            rn, gn, bn = r / 255.0, g / 255.0, b / 255.0
            h_val, s_val, v_val = colorsys.rgb_to_hsv(rn, gn, bn)
            hue_deg = h_val * 360.0

            # Exclude extreme white/black background pixels
            if v_val < 0.18 or (s_val < 0.15 and v_val > 0.85):
                continue
            candidates.append((hue_deg, s_val, v_val))

        if not candidates:
            return "unknown"

        # Median hue, saturation, value
        candidates.sort(key=lambda x: x[0])
        med_hue, med_s, med_v = candidates[len(candidates) // 2]

        # Railroad / Greyscale check
        if med_s < 0.20:
            return "railroad" if med_v < 0.45 else "unknown"

        # Brown: Hue 10..40 with moderate saturation and darker value
        if 10 <= med_hue <= 42 and med_v < 0.60:
            return "brown"

        # Orange: Hue 15..45 with high brightness/saturation
        if 15 <= med_hue <= 45 and med_v >= 0.60 and med_s >= 0.45:
            return "orange"

        # Yellow: Hue 45..70
        if 45 <= med_hue <= 70 and med_s >= 0.35:
            return "yellow"

        # Green: Hue 75..165
        if 75 <= med_hue <= 165 and med_s >= 0.25:
            return "green"

        # Cyan / Light Blue: Hue 170..210
        if 170 <= med_hue <= 210 and med_s >= 0.25:
            return "cyan"

        # Dark Blue: Hue 210..260
        if 210 <= med_hue <= 260 and med_s >= 0.35:
            return "darkblue"

        # Pink / Magenta: Hue 280..350
        if 280 <= med_hue <= 350 and med_s >= 0.25:
            return "pink"

        # Red: Hue >= 350 or Hue < 12
        if (med_hue >= 350 or med_hue < 12) and med_s >= 0.35:
            return "red"

        return "unknown"
    except Exception:
        return "unknown"


def clean_dotmatrix_code(raw_code: str) -> str:
    """
    Normalizes 10 to 14 character alphanumeric McDonald's Monopoly codes.
    """
    if not raw_code:
        return ""
    c = re.sub(r'[^A-Z0-9]', '', str(raw_code).upper().strip())
    return c


def extract_from_image_path(image_path: str, model_name: str = VISION_MODEL) -> List[Dict[str, Any]]:
    """
    Uses local Qwen3-VL Vision model to directly transcribe ALL Monopoly game stamps
    from a single or multi-stamp image (handling mobile EXIF orientation and high-res scaling),
    and cross-validates against deterministic color-bar CV detection.
    """
    import io
    from PIL import ImageOps

    p = Path(image_path)
    if not p.exists():
        return []

    # 1. Load image, apply mobile EXIF orientation transpose, and scale down if > 1500px
    detected_color = "unknown"
    try:
        with Image.open(p) as raw_img:
            img = ImageOps.exif_transpose(raw_img).convert("RGB")
            detected_color = detect_color_bar_from_image(img)
            max_dim = 1500
            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        with open(p, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = """Examine this image and transcribe EVERY McDonald's Monopoly game piece sticker visible (there may be 1 or multiple stickers in the photo).
For EACH sticker found, transcribe:
1. Property Name & Stamp Number (e.g. "Signal Hill #809", "Niagara Falls #822", "Sea to Sky Highway #827", "Halifax Airport #825", "Baffin Island #813") or Food Instant Win Prize.
2. The exact 14-character alphanumeric code printed vertically/horizontally on the sticker (e.g. "4XK41HZN99396W"). Pay close attention to 8 vs B, 5 vs S, 0 vs O, 1 vs I.
3. Whether it is a known rare piece (#801, #804, #806, #811, #812, #817, #820, #821, #826, #828).

Return strictly a valid JSON array containing one object per sticker found:
[
  {
    "label": "<Property Name & Number, e.g. Signal Hill #809>",
    "stamp_number": "<e.g. #809>",
    "code": "<14-character alphanumeric code>",
    "piece_type": "property",
    "is_rare": false
  }
]"""

    candidate_models = []
    for m in ([model_name] + FALLBACK_VISION_MODELS):
        if m and m not in candidate_models:
            candidate_models.append(m)

    last_error = None
    for candidate_model in candidate_models:
        req_data = {
            "model": candidate_model,
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
            "max_tokens": 1024
        }

        try:
            req = urllib.request.Request(
                API_URL,
                headers={"Content-Type": "application/json"},
                data=json.dumps(req_data).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode())
                txt = data["choices"][0]["message"]["content"].strip()
                txt = re.sub(r"^```json\s*", "", txt)
                txt = re.sub(r"^```\s*", "", txt)
                txt = re.sub(r"\s*```$", "", txt)

                # Extract JSON array or object even if model included surrounding prose
                arr_match = re.search(r"\[.*\]", txt, re.DOTALL)
                if arr_match:
                    txt = arr_match.group(0)

                parsed = json.loads(txt)
                if isinstance(parsed, dict):
                    parsed = [parsed]

                single_piece_image = len(parsed) == 1

                for item in parsed:
                    item["code"] = clean_dotmatrix_code(item.get("code", ""))
                    stamp_num = item.get("stamp_number", "").strip().upper()
                    if stamp_num and not stamp_num.startswith("#"):
                        stamp_num = "#" + re.sub(r"[^0-9]", "", stamp_num)
                        item["stamp_number"] = stamp_num

                    # Only apply full-image single-banner CV cross-check if 1 stamp fills the frame
                    if single_piece_image and stamp_num and detected_color != "unknown":
                        item["detected_banner_color"] = detected_color
                        expected_color = COLOR_BY_STAMP.get(stamp_num)
                        if expected_color and expected_color != detected_color:
                            item["is_unsure"] = True
                            item["flag_reason"] = (
                                f"Color mismatch: OCR read {stamp_num} ({expected_color}), "
                                f"but physical banner is {detected_color}."
                            )
                            if item.get("is_rare"):
                                item["is_rare"] = False
                    else:
                        expected_color = COLOR_BY_STAMP.get(stamp_num, detected_color)
                        item["detected_banner_color"] = expected_color

                return parsed
        except Exception as e:
            last_error = str(e)
            continue

    raise RuntimeError(f"Vision extraction failed across candidate models ({', '.join(candidate_models)}): {last_error}")


def extract_mcnopoly_stamps(raw_ocr_or_text: str, model_name: str = "qwen3-vl-8b-instruct") -> List[Dict[str, Any]]:
    """
    Fallback for raw text/OCR snippets.
    """
    code_match = re.search(r'[A-Z0-9]{10,14}', raw_ocr_or_text.upper())
    code = code_match.group(0) if code_match else ""
    return [{
        "label": raw_ocr_or_text.splitlines()[0][:60] if raw_ocr_or_text else "Game Piece",
        "stamp_number": "",
        "code": code,
        "piece_type": "property" if code else "unsure",
        "is_rare": False
    }]
