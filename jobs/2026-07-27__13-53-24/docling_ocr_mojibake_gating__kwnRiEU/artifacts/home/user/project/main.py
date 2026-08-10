#!/usr/bin/env python3
"""
Two-Pass OCR Gating Pipeline for Docling.

Pass 1: Extract each page's text from the PDF's embedded programmatic text
        layer only (OCR disabled) and compute a garble_score for it.
Pass 2: For every page whose garble_score is above the threshold, re-extract
        that page's text using Tesseract OCR on the rendered page image.

Outputs:
  - output/gating_report.json
  - output/repaired.md
"""

import json
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    TesseractCliOcrOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

PROJECT_ROOT = Path(__file__).resolve().parent
SOURCE_PDF = PROJECT_ROOT / "assets" / "source.pdf"
OUTPUT_DIR = PROJECT_ROOT / "output"
GATING_REPORT_PATH = OUTPUT_DIR / "gating_report.json"
REPAIRED_MD_PATH = OUTPUT_DIR / "repaired.md"

GARBLE_THRESHOLD = 0.30


def count_non_whitespace(text: str) -> int:
    """Number of characters in text that are not Unicode whitespace."""
    return sum(1 for ch in text if not ch.isspace())


def compute_garble_score(text: str) -> float:
    """
    garble_score = S / N, where N is the count of non-whitespace characters
    and S is the count of those characters whose code point falls outside
    the inclusive printable-ASCII range U+0020-U+007E.
    When N == 0, garble_score is defined to be exactly 1.0.
    """
    non_ws_chars = [ch for ch in text if not ch.isspace()]
    n = len(non_ws_chars)
    if n == 0:
        return 1.0
    s = sum(1 for ch in non_ws_chars if not (0x20 <= ord(ch) <= 0x7E))
    return s / n


def build_programmatic_converter() -> DocumentConverter:
    """Converter configured for Pass 1: programmatic text layer only, no OCR."""
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )


def build_ocr_converter() -> DocumentConverter:
    """Converter configured for Pass 2: forced full-page Tesseract OCR (English)."""
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.ocr_options = TesseractCliOcrOptions(
        lang=["eng"],
        force_full_page_ocr=True,
    )
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )


def run_pass1(converter: DocumentConverter) -> tuple[int, dict[int, str]]:
    """Run Pass 1 over the whole document, returning page_count and per-page text."""
    result = converter.convert(str(SOURCE_PDF))
    doc = result.document
    page_count = doc.num_pages()
    page_texts: dict[int, str] = {}
    for page_no in range(1, page_count + 1):
        page_texts[page_no] = doc.export_to_text(page_no=page_no)
    return page_count, page_texts


def run_pass2_for_page(converter: DocumentConverter, page_no: int) -> str:
    """Run Pass 2 (Tesseract OCR) for a single page and return its OCR text."""
    result = converter.convert(str(SOURCE_PDF), page_range=(page_no, page_no))
    doc = result.document
    return doc.export_to_text(page_no=page_no)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Pass 1: programmatic text layer extraction + garble scoring ---
    programmatic_converter = build_programmatic_converter()
    page_count, programmatic_texts = run_pass1(programmatic_converter)

    pages_report = []
    chosen_texts: dict[int, str] = {}

    for page_no in range(1, page_count + 1):
        prog_text = programmatic_texts[page_no]
        garble_score = compute_garble_score(prog_text)
        needs_ocr = garble_score >= GARBLE_THRESHOLD
        programmatic_char_count = count_non_whitespace(prog_text)

        pages_report.append(
            {
                "page_no": page_no,
                "garble_score": round(garble_score, 4),
                "programmatic_char_count": programmatic_char_count,
                "ocr_char_count": None,
                "text_source": "ocr" if needs_ocr else "programmatic",
                "needs_ocr": needs_ocr,
            }
        )
        chosen_texts[page_no] = prog_text

    # --- Pass 2: OCR repair only for flagged pages ---
    pages_needing_repair = [p["page_no"] for p in pages_report if p["needs_ocr"]]
    if pages_needing_repair:
        ocr_converter = build_ocr_converter()
        for page_no in pages_needing_repair:
            ocr_text = run_pass2_for_page(ocr_converter, page_no)
            ocr_char_count = count_non_whitespace(ocr_text)

            page_entry = pages_report[page_no - 1]
            page_entry["ocr_char_count"] = ocr_char_count
            chosen_texts[page_no] = ocr_text

    # --- Write gating report ---
    gating_report = {
        "source_pdf": "assets/source.pdf",
        "garble_threshold": GARBLE_THRESHOLD,
        "page_count": page_count,
        "pages": pages_report,
    }
    with open(GATING_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(gating_report, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # --- Write repaired markdown ---
    repaired_parts = [chosen_texts[page_no] for page_no in range(1, page_count + 1)]
    repaired_content = "\n\n".join(repaired_parts)
    with open(REPAIRED_MD_PATH, "w", encoding="utf-8") as f:
        f.write(repaired_content)
        f.write("\n")


if __name__ == "__main__":
    main()
