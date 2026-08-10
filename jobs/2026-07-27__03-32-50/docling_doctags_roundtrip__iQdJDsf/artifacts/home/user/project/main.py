#!/usr/bin/env python3
"""DocTags round-trip fidelity pipeline.

Given a PDF, this script:
  1. Converts the PDF into a DoclingDocument (the "original" document).
  2. Serializes the original document to DocTags and writes it verbatim
     to out/original.doctags.
  3. Reconstructs a brand-new DoclingDocument by parsing the DocTags file
     back in (the "reconstructed" document).
  4. Re-exports the reconstructed document to Markdown at out/reconstructed.md.
  5. Emits a JSON comparison report at out/comparison_report.json quantifying
     structural equivalence between the original and reconstructed documents.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

OUT_DIR = Path("out")
DOCTAGS_PATH = OUT_DIR / "original.doctags"
MARKDOWN_PATH = OUT_DIR / "reconstructed.md"
REPORT_PATH = OUT_DIR / "comparison_report.json"


def _count_headings(doc) -> int:
    """Count section-header text items (the document title is excluded)."""
    from docling_core.types.doc.labels import DocItemLabel

    return sum(1 for item in doc.texts if item.label == DocItemLabel.SECTION_HEADER)


def _summarize(doc) -> dict:
    return {
        "texts": len(doc.texts),
        "tables": len(doc.tables),
        "pictures": len(doc.pictures),
        "headings": _count_headings(doc),
    }


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        sys.stderr.write("Usage: python main.py <input_pdf_path>\n")
        return 2

    input_path = Path(argv[1])
    if not input_path.is_file():
        sys.stderr.write(f"Error: input file not found: {input_path}\n")
        return 2

    try:
        from docling.document_converter import DocumentConverter
        from docling_core.types.doc.doctags import DocTagsDocument
        from docling_core.types.doc.document import DoclingDocument

        # 1. Convert the PDF into a DoclingDocument (the "original" document).
        converter = DocumentConverter()
        conversion_result = converter.convert(str(input_path))
        original_doc = conversion_result.document

        OUT_DIR.mkdir(parents=True, exist_ok=True)

        # 2. Serialize the original document to DocTags, written verbatim.
        original_doc.save_as_doctags(DOCTAGS_PATH)

        # 3. Reconstruct a brand-new DoclingDocument by parsing the DocTags
        #    file back in (must be read from disk, not the in-memory object).
        doctags_doc = DocTagsDocument.from_doctags_and_image_pairs(
            [DOCTAGS_PATH], None
        )
        reconstructed_doc = DoclingDocument.load_from_doctags(
            doctags_doc, document_name=input_path.stem
        )

        # 4. Re-export the reconstructed document to Markdown.
        reconstructed_doc.save_as_markdown(MARKDOWN_PATH)

        # 5. Emit a JSON comparison report.
        original_summary = _summarize(original_doc)
        reconstructed_summary = _summarize(reconstructed_doc)
        match = {
            key: original_summary[key] == reconstructed_summary[key]
            for key in ("texts", "tables", "pictures", "headings")
        }
        report = {
            "original": original_summary,
            "reconstructed": reconstructed_summary,
            "match": match,
            "equivalent": all(match.values()),
        }
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001 - convert any failure into exit code
        sys.stderr.write(f"Error: {exc}\n")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
