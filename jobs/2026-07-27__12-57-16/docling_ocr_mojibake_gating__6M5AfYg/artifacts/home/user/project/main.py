import os
import json
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractOcrOptions
from docling.datamodel.base_models import InputFormat

def compute_garble_score(text: str):
    # N is the number of characters in T that are not Unicode whitespace
    non_whitespace_chars = [c for c in text if not c.isspace()]
    N = len(non_whitespace_chars)
    if N == 0:
        return 1.0, 0
    # S is the number of those N characters whose Unicode code point is outside [0x0020, 0x007E]
    S = len([c for c in non_whitespace_chars if not (0x0020 <= ord(c) <= 0x007E)])
    score = S / N
    return round(score, 4), N

def main():
    PROJECT_DIR = Path("/home/user/project")
    INPUT_PDF = PROJECT_DIR / "assets/source.pdf"
    OUTPUT_DIR = PROJECT_DIR / "output"
    GATING_REPORT_PATH = OUTPUT_DIR / "gating_report.json"
    REPAIRED_MD_PATH = OUTPUT_DIR / "repaired.md"

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Starting Pass 1: Programmatic text extraction...")
    # Setup Pass 1 converter (no OCR)
    pipeline_options_pass1 = PdfPipelineOptions()
    pipeline_options_pass1.do_ocr = False

    converter_pass1 = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options_pass1)
        }
    )
    
    result_pass1 = converter_pass1.convert(INPUT_PDF)
    page_count = len(result_pass1.document.pages)
    print(f"Pass 1 completed. Found {page_count} pages.")

    pages_report = []
    page_texts = {}

    for p in range(1, page_count + 1):
        # Extract Pass 1 text
        pass1_text = result_pass1.document.export_to_markdown(page_no=p)
        
        garble_score, programmatic_char_count = compute_garble_score(pass1_text)
        needs_ocr = garble_score >= 0.30
        text_source = "ocr" if needs_ocr else "programmatic"

        if not needs_ocr:
            page_texts[p] = pass1_text

        pages_report.append({
            "page_no": p,
            "garble_score": garble_score,
            "programmatic_char_count": programmatic_char_count,
            "ocr_char_count": None,
            "text_source": text_source,
            "needs_ocr": needs_ocr
        })

    # Setup Pass 2 converter (Tesseract OCR)
    print("Setting up Pass 2: Tesseract OCR...")
    pipeline_options_pass2 = PdfPipelineOptions()
    pipeline_options_pass2.do_ocr = True
    pipeline_options_pass2.ocr_options = TesseractOcrOptions(lang=["eng"], force_full_page_ocr=True)

    converter_pass2 = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options_pass2)
        }
    )

    for item in pages_report:
        p = item["page_no"]
        if item["needs_ocr"]:
            print(f"Page {p} flagged for OCR repair (garble_score = {item['garble_score']}). Running Tesseract...")
            result_pass2 = converter_pass2.convert(INPUT_PDF, page_range=(p, p))
            ocr_text = result_pass2.document.export_to_markdown()
            
            # Count non-whitespace chars in OCR text
            ocr_non_ws = [c for c in ocr_text if not c.isspace()]
            item["ocr_char_count"] = len(ocr_non_ws)
            page_texts[p] = ocr_text
        else:
            print(f"Page {p} is clean (garble_score = {item['garble_score']}). Skipping OCR.")

    # Write Gating Report
    report = {
        "source_pdf": "assets/source.pdf",
        "garble_threshold": 0.30,
        "page_count": page_count,
        "pages": pages_report
    }

    with open(GATING_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Wrote gating report to {GATING_REPORT_PATH}")

    # Write Repaired Markdown
    # Concatenate each page's chosen text, stripped of leading/trailing whitespace, separated by a single blank line.
    repaired_pages = []
    for p in range(1, page_count + 1):
        repaired_pages.append(page_texts[p].strip())

    repaired_md_content = "\n\n".join(repaired_pages) + "\n"

    with open(REPAIRED_MD_PATH, "w", encoding="utf-8") as f:
        f.write(repaired_md_content)
    print(f"Wrote repaired markdown to {REPAIRED_MD_PATH}")

if __name__ == "__main__":
    main()
