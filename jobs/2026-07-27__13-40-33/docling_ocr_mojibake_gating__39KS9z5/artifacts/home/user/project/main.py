#!/usr/bin/env python3
"""Two-pass OCR gating pipeline for Docling.

Pass 1: extract the embedded programmatic text layer of every page using
Docling with OCR disabled.

For every page a ``garble_score`` is computed from its Pass-1 text. Pages
whose programmatic text is unusable (``garble_score >= GARBLE_THRESHOLD``)
are repaired in Pass 2 by running the Tesseract OCR engine (English) on a
rendered image of that page.

The pipeline emits a repaired Markdown document (programmatic text for clean
pages, OCR text for repaired pages) and a machine-readable gating report.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# Silence Docling's chatty logging; only the two output files matter for this
# pipeline. (Tqdm progress bars still go to stderr but do not affect output.)
logging.disable(logging.CRITICAL)

import pypdfium2 as pdfium
import tesserocr
from PIL import Image

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR = Path(__file__).resolve().parent
SOURCE_PDF = PROJECT_DIR / "assets" / "source.pdf"
SOURCE_PDF_REL = "assets/source.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"
GATING_REPORT_PATH = OUTPUT_DIR / "gating_report.json"
REPAIRED_PATH = OUTPUT_DIR / "repaired.md"

GARBLE_THRESHOLD = 0.30
# DPI used when rendering a page image for Tesseract OCR.
OCR_DPI = 300


# ---------------------------------------------------------------------------
# Garble scoring
# ---------------------------------------------------------------------------
def compute_garble_score(text: str) -> tuple[float, int]:
    """Return ``(garble_score, programmatic_char_count)`` for ``text``.

    ``programmatic_char_count`` is the number of non-whitespace characters
    (``N``). ``garble_score`` is ``S / N`` where ``S`` is the number of those
    characters outside the printable-ASCII range U+0020-U+007E. When ``N == 0``
    the garble score is defined to be exactly ``1.0``.
    """
    n = 0
    s = 0
    for ch in text:
        if ch.isspace():
            continue
        n += 1
        code = ord(ch)
        if not (0x20 <= code <= 0x7E):
            s += 1
    if n == 0:
        return 1.0, 0
    return s / n, n


# ---------------------------------------------------------------------------
# Pass 1: programmatic text layer (OCR disabled)
# ---------------------------------------------------------------------------
def extract_programmatic_text() -> dict[int, str]:
    """Extract per-page programmatic text via Docling with OCR disabled.

    Returns a mapping of 1-based page number -> page markdown text.
    """
    pipeline_options = PdfPipelineOptions(
        do_ocr=False,
        do_table_structure=False,
        force_backend_text=True,
        generate_page_images=False,
        generate_picture_images=False,
    )
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    result = converter.convert(str(SOURCE_PDF))
    document = result.document

    page_numbers = sorted(document.pages.keys())
    texts: dict[int, str] = {}
    for page_no in page_numbers:
        texts[page_no] = document.export_to_markdown(page_no=page_no)
    return texts


# ---------------------------------------------------------------------------
# Pass 2: Tesseract OCR on rendered page images
# ---------------------------------------------------------------------------
def render_page_image(pdf: pdfium.PdfDocument, page_no: int) -> Image.Image:
    """Render the 1-based ``page_no`` of ``pdf`` to a PIL image at ``OCR_DPI``."""
    page = pdf[page_no - 1]
    scale = OCR_DPI / 72.0
    image = page.render(scale=scale).to_pil()
    return image.convert("RGB")


def ocr_page(pdf: pdfium.PdfDocument, page_no: int) -> str:
    """Run Tesseract OCR (English) on a rendered image of ``page_no``."""
    image = render_page_image(pdf, page_no)
    with tesserocr.PyTessBaseAPI(lang="eng") as api:
        api.SetImage(image)
        text = api.GetUTF8Text() or ""
    return text


def count_non_whitespace(text: str) -> int:
    return sum(1 for ch in text if not ch.isspace())


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------
def run_pipeline() -> None:
    programmatic_texts = extract_programmatic_text()
    page_numbers = sorted(programmatic_texts.keys())

    # Pass 1 scoring + gating decision.
    page_records: list[dict] = []
    for page_no in page_numbers:
        text = programmatic_texts[page_no]
        garble_score, programmatic_char_count = compute_garble_score(text)
        needs_ocr = garble_score >= GARBLE_THRESHOLD
        page_records.append(
            {
                "page_no": page_no,
                "garble_score": round(garble_score, 4),
                "programmatic_char_count": programmatic_char_count,
                "ocr_char_count": None,
                "text_source": "ocr" if needs_ocr else "programmatic",
                "needs_ocr": needs_ocr,
                "_chosen_text": text,
            }
        )

    # Pass 2: OCR only for pages that need repair.
    pdf = pdfium.PdfDocument(str(SOURCE_PDF))
    try:
        for record in page_records:
            if record["needs_ocr"]:
                ocr_text = ocr_page(pdf, record["page_no"])
                record["ocr_char_count"] = count_non_whitespace(ocr_text)
                record["_chosen_text"] = ocr_text
    finally:
        pdf.close()

    # Build the repaired Markdown document: chosen text per page, separated by
    # a single blank line. Each page's text is stripped of surrounding
    # whitespace so the separator is exactly one blank line.
    chosen_texts = [record["_chosen_text"].strip() for record in page_records]
    repaired_md = "\n\n".join(chosen_texts)

    # Build the gating report (ordered keys, matching the required schema).
    report = {
        "source_pdf": SOURCE_PDF_REL,
        "garble_threshold": GARBLE_THRESHOLD,
        "page_count": len(page_records),
        "pages": [
            {
                "page_no": record["page_no"],
                "garble_score": record["garble_score"],
                "programmatic_char_count": record["programmatic_char_count"],
                "ocr_char_count": record["ocr_char_count"],
                "text_source": record["text_source"],
                "needs_ocr": record["needs_ocr"],
            }
            for record in page_records
        ],
    }

    # Idempotently write both output files.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    GATING_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    REPAIRED_PATH.write_text(repaired_md, encoding="utf-8")


def main() -> int:
    run_pipeline()
    return 0


if __name__ == "__main__":
    sys.exit(main())