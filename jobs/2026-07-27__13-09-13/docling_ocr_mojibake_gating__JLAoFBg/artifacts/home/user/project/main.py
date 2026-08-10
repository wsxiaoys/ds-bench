#!/usr/bin/env python3
"""Two-Pass OCR Gating Pipeline for Docling.

Pass 1: Extract programmatic text layer from every page (OCR disabled).
Pass 2: For pages flagged as garbled, re-extract using Tesseract OCR.
Output: repaired Markdown + per-page gating report JSON.
"""

import json
import os
import re
import unicodedata
from pathlib import Path

import tesserocr
from PIL import Image

from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INPUT_PDF = Path("/home/user/project/assets/source.pdf")
OUTPUT_DIR = Path("/home/user/project/output")
GATING_REPORT_PATH = OUTPUT_DIR / "gating_report.json"
REPAIRED_MD_PATH = OUTPUT_DIR / "repaired.md"

GARBLE_THRESHOLD = 0.30


# ---------------------------------------------------------------------------
# Garble score
# ---------------------------------------------------------------------------
def compute_garble_score(text: str) -> float:
    """Compute the garble score for a page's text.

    N = number of non-whitespace characters.
    S = number of those N characters whose code point is outside U+0020–U+007E.
    Returns S/N, or 1.0 when N == 0.
    """
    non_ws = [c for c in text if not unicodedata.category(c).startswith("Z") and c not in ("\r", "\n", "\t", "\v", "\f")]
    N = len(non_ws)
    if N == 0:
        return 1.0
    S = sum(1 for c in non_ws if ord(c) < 0x20 or ord(c) > 0x7E)
    return round(S / N, 4)


# ---------------------------------------------------------------------------
# Pass 1 – programmatic text extraction (no OCR)
# ---------------------------------------------------------------------------
def pass1_extract(pdf_path: Path):
    """Extract programmatic-layer text from every page, plus page images."""
    pipeline_opts = PdfPipelineOptions()
    pipeline_opts.do_ocr = False
    pipeline_opts.force_backend_text = True
    pipeline_opts.generate_page_images = True

    converter = DocumentConverter(
        format_options={
            "pdf": PdfFormatOption(pipeline_options=pipeline_opts)
        }
    )
    result = converter.convert(pdf_path)
    doc = result.document

    # Group text items by page number (1-based)
    page_texts: dict[int, list[str]] = {}
    for text_item in doc.texts:
        pn = text_item.prov[0].page_no
        page_texts.setdefault(pn, []).append(text_item.text)

    # Build per-page programmatic text
    num_pages = len(result.pages)
    programmatic_texts: dict[int, str] = {}
    for pn in range(1, num_pages + 1):
        programmatic_texts[pn] = "\n".join(page_texts.get(pn, []))

    return programmatic_texts, result.pages


# ---------------------------------------------------------------------------
# Pass 2 – OCR for flagged pages
# ---------------------------------------------------------------------------
def ocr_page(page_image: Image.Image) -> str:
    """Run Tesseract OCR (English) on a single page image."""
    api = tesserocr.PyTessBaseAPI(lang="eng")
    try:
        api.SetImage(page_image)
        text = api.GetUTF8Text()
    finally:
        api.End()
    return text


def pass2_ocr(flagged_pages: set[int], pass1_pages):
    """Run OCR only for pages whose numbers are in flagged_pages.

    Returns dict: page_no -> OCR text.
    """
    ocr_texts: dict[int, str] = {}
    for page in pass1_pages:
        if page.page_no in flagged_pages:
            ocr_texts[page.page_no] = ocr_page(page.image)
    return ocr_texts


# ---------------------------------------------------------------------------
# Non-whitespace character count
# ---------------------------------------------------------------------------
def non_ws_char_count(text: str) -> int:
    """Count characters that are not Unicode whitespace."""
    return sum(
        1
        for c in text
        if not unicodedata.category(c).startswith("Z")
        and c not in ("\r", "\n", "\t", "\v", "\f")
    )


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def main():
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ---- Pass 1 ----
    print("[Pass 1] Extracting programmatic text layer (OCR disabled)...")
    programmatic_texts, pages = pass1_extract(INPUT_PDF)
    page_count = len(pages)

    # ---- Compute garble scores & gating decisions ----
    gating_pages = []
    flagged_pages: set[int] = set()

    for page in pages:
        pn = page.page_no
        prog_text = programmatic_texts[pn]
        garble_score = compute_garble_score(prog_text)
        prog_char_count = non_ws_char_count(prog_text)
        needs_ocr = garble_score >= GARBLE_THRESHOLD

        if needs_ocr:
            flagged_pages.add(pn)

        gating_pages.append({
            "page_no": pn,
            "garble_score": garble_score,
            "programmatic_char_count": prog_char_count,
            "ocr_char_count": None,  # filled after Pass 2
            "text_source": "ocr" if needs_ocr else "programmatic",
            "needs_ocr": needs_ocr,
        })

    # ---- Pass 2 ----
    if flagged_pages:
        print(f"[Pass 2] Running Tesseract OCR on {len(flagged_pages)} flagged page(s): {sorted(flagged_pages)}")
    else:
        print("[Pass 2] No pages flagged for OCR – skipping.")

    ocr_texts = pass2_ocr(flagged_pages, pages)

    # ---- Update gating report with OCR char counts ----
    for entry in gating_pages:
        pn = entry["page_no"]
        if entry["needs_ocr"]:
            ocr_text = ocr_texts.get(pn, "")
            entry["ocr_char_count"] = non_ws_char_count(ocr_text)
        # else: stays None

    # ---- Build repaired Markdown ----
    repaired_lines: list[str] = []
    for entry in gating_pages:
        pn = entry["page_no"]
        if entry["text_source"] == "ocr":
            text = ocr_texts[pn].rstrip("\n")
        else:
            text = programmatic_texts[pn].rstrip("\n")
        if text:
            repaired_lines.append(text)

    repaired_md = "\n\n".join(repaired_lines) + "\n"

    # ---- Write outputs ----
    report = {
        "source_pdf": "assets/source.pdf",
        "garble_threshold": GARBLE_THRESHOLD,
        "page_count": page_count,
        "pages": gating_pages,
    }

    with open(GATING_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(REPAIRED_MD_PATH, "w", encoding="utf-8") as f:
        f.write(repaired_md)

    print(f"[Done] Wrote {GATING_REPORT_PATH} and {REPAIRED_MD_PATH}")


if __name__ == "__main__":
    main()
