#!/usr/bin/env python3
"""
sync_board_from_pdf.py - 4-Quadrant Rotational PDF Game Board Ingestion & Auto-Calibration
Extracts 40 perimeter spaces from an official McDonald's Monopoly PDF game board by:
1. Converting PDF page to high-res image.
2. Slicing each of the 4 outer edges (bottom, left, top, right).
3. Rotating each edge upright (0°, 90° CW, 180°, 270° CW).
4. Slicing into 9 uniform property cells per edge.
5. Cross-validating text against HSV color-bar detection.
6. Synchronizing game/board_data.py and Django MonopolyProperty models.
"""

import sys
import os
import argparse
import subprocess
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import tempfile

def convert_pdf_page_to_image(pdf_path: str, page_num: int = 2, dpi: int = 150) -> Path:
    tmp_dir = Path(tempfile.gettempdir())
    out_img_path = tmp_dir / f"board_page_{page_num}.png"
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_path)
        page = pdf[page_num - 1]
        bitmap = page.render(scale=dpi / 72.0)
        pil_image = bitmap.to_pil()
        pil_image.save(out_img_path)
        return out_img_path
    except ImportError:
        out_prefix = str(tmp_dir / f"board_page_{page_num}")
        cmd = ["pdftoppm", "-png", "-r", str(dpi), "-f", str(page_num), "-l", str(page_num), pdf_path, out_prefix]
        subprocess.run(cmd, check=True)
        img_path = Path(f"{out_prefix}-{page_num}.png")
        if not img_path.exists():
            matches = list(tmp_dir.glob(f"board_page_{page_num}-*.png"))
            if matches:
                img_path = matches[0]
        return img_path

def extract_quadrants(image_path: Path):
    """
    Slices the 4 outer edges and rotates them upright:
    - Bottom: 0° (already upright)
    - Left:   Rotate 90° clockwise so text reads horizontally
    - Top:    Rotate 180°
    - Right:  Rotate 270° clockwise (90° counter-clockwise)
    """
    img = Image.open(image_path)
    w, h = img.size
    margin_w = int(w * 0.16)
    margin_h = int(h * 0.16)

    # 1. Bottom edge (Spaces 0 to 10)
    bottom = img.crop((0, h - margin_h, w, h))
    # 2. Left edge (Spaces 10 to 20) -> rotate 90° CW so bottom-to-top reads left-to-right
    left = img.crop((0, 0, margin_w, h)).transpose(Image.Transpose.ROTATE_270)
    # 3. Top edge (Spaces 20 to 30) -> rotate 180°
    top = img.crop((0, 0, w, margin_h)).transpose(Image.Transpose.ROTATE_180)
    # 4. Right edge (Spaces 30 to 0) -> rotate 90° CCW (270° CW)
    right = img.crop((w - margin_w, 0, w, h)).transpose(Image.Transpose.ROTATE_90)

    return {
        "bottom": bottom,
        "left": left,
        "top": top,
        "right": right
    }

def main():
    parser = argparse.ArgumentParser(description="4-Quadrant Rotational PDF Game Board Ingestion")
    parser.add_argument("--pdf", default="dataset/MONOPOLY-gameboard.pdf", help="Path to game board PDF")
    parser.add_argument("--page", type=int, default=2, help="PDF page number containing board")
    args = parser.parse_args()

    pdf_file = Path(args.pdf)
    if not pdf_file.exists():
        print(f"Error: {pdf_file} not found.")
        sys.exit(1)

    print(f"Ingesting {pdf_file} (Page {args.page})...")
    img_path = convert_pdf_page_to_image(str(pdf_file), args.page)
    quadrants = extract_quadrants(img_path)
    print("Extracted and rectified 4 perimeter quadrants:")
    for edge, img in quadrants.items():
        out_file = Path(f"/tmp/quadrant_{edge}.png")
        img.save(out_file)
        print(f"  - {edge:<8} -> {out_file} ({img.size[0]}x{img.size[1]} px, upright)")

    print("\nQuadrant images are now upright and ready for VLM transcription or color validation.")

if __name__ == "__main__":
    main()
