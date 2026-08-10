#!/usr/bin/env python3
"""Reconstruct multi-column human reading order from Docling layout provenance.

Parses assets/report.pdf fully offline with docling, then - relying only on
page geometry (bounding boxes + page size) - reconstructs the reading order of
each page: full-width spanning elements first (top-to-bottom), then each body
text column left-to-right, top-to-bottom within a column. Running page
headers, page footers and standalone page numbers are dropped entirely.

Outputs:
    output/pages.json         machine readable per-page description
    output/reading_order.txt  linearized plain-text rendering of the document
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from docling.document_converter import DocumentConverter
from docling_core.types.doc.labels import DocItemLabel

PROJECT_DIR = Path(__file__).resolve().parent
INPUT_PDF = PROJECT_DIR / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"

# Labels that are never part of the human reading order.
EXCLUDED_LABELS = {DocItemLabel.PAGE_HEADER, DocItemLabel.PAGE_FOOTER}

# An element whose width is at least this fraction of the page's overall
# kept-content width is considered a "full-width spanning" element (e.g. a
# title placed above a multi-column body) rather than a member of a column.
FULL_WIDTH_RATIO = 0.6

# When clustering body elements into columns by their horizontal center, two
# elements are considered part of the same column if the gap between their
# centers is no larger than this fraction of the kept-content width.
COLUMN_GAP_RATIO = 0.15


def is_standalone_page_number(text: str) -> bool:
    """True if `text` looks like a bare page number (e.g. "3", "- 3 -")."""
    stripped = text.strip().strip("-").strip()
    return bool(stripped) and stripped.isdigit()


def extract_page_elements(doc) -> dict[int, list[dict[str, Any]]]:
    """Collect kept text elements per page, converted to top-left bboxes."""
    pages: dict[int, list[dict[str, Any]]] = {
        page_no: [] for page_no in doc.pages.keys()
    }

    for item in doc.texts:
        if item.label in EXCLUDED_LABELS:
            continue
        if is_standalone_page_number(item.text):
            continue
        if not item.prov:
            continue

        prov = item.prov[0]
        page_no = prov.page_no
        page_info = doc.pages.get(page_no)
        page_height = page_info.size.height if page_info else 0.0

        bbox = prov.bbox.to_top_left_origin(page_height)

        pages.setdefault(page_no, []).append(
            {
                "self_ref": item.self_ref,
                "text": item.text,
                "l": bbox.l,
                "t": bbox.t,
                "r": bbox.r,
                "b": bbox.b,
            }
        )

    return pages


def cluster_into_columns(
    candidates: list[dict[str, Any]], gap_threshold: float
) -> list[list[dict[str, Any]]]:
    """Group elements into left-to-right column clusters by x-center gaps."""
    if not candidates:
        return []

    ordered = sorted(candidates, key=lambda e: (e["l"] + e["r"]) / 2.0)
    clusters: list[list[dict[str, Any]]] = [[ordered[0]]]
    last_center = (ordered[0]["l"] + ordered[0]["r"]) / 2.0

    for elem in ordered[1:]:
        center = (elem["l"] + elem["r"]) / 2.0
        if (center - last_center) <= gap_threshold:
            clusters[-1].append(elem)
        else:
            clusters.append([elem])
        last_center = center

    # Sort each resulting cluster left-to-right by its average left edge.
    clusters.sort(key=lambda c: sum(e["l"] for e in c) / len(c))
    return clusters


def build_page_reading_order(
    page_no: int, elements: list[dict[str, Any]]
) -> dict[str, Any]:
    """Assign column indices and compute reading order for one page."""
    if not elements:
        return {"page_no": page_no, "column_count": 1, "elements": []}

    content_l = min(e["l"] for e in elements)
    content_r = max(e["r"] for e in elements)
    content_width = max(content_r - content_l, 1e-6)

    full_width_elems = []
    candidate_elems = []
    for e in elements:
        rel_width = (e["r"] - e["l"]) / content_width
        if rel_width >= FULL_WIDTH_RATIO:
            full_width_elems.append(e)
        else:
            candidate_elems.append(e)

    gap_threshold = content_width * COLUMN_GAP_RATIO
    clusters = cluster_into_columns(candidate_elems, gap_threshold)

    if len(clusters) >= 2:
        column_count = len(clusters)
        for idx, cluster in enumerate(clusters):
            for e in cluster:
                e["column"] = idx
        for e in full_width_elems:
            e["column"] = 0
        all_elements = full_width_elems + [e for c in clusters for e in c]
    else:
        # No genuine multi-column structure detected on this page: treat it
        # as a single body column (full-width classification was spurious).
        column_count = 1
        for e in elements:
            e["column"] = 0
        all_elements = elements

    all_elements.sort(key=lambda e: (e["column"], e["t"]))

    out_elements = [
        {
            "id": e["self_ref"],
            "column": e["column"],
            "bbox": [
                round(e["l"], 3),
                round(e["t"], 3),
                round(e["r"], 3),
                round(e["b"], 3),
            ],
        }
        for e in all_elements
    ]

    return {
        "page_no": page_no,
        "column_count": column_count,
        "elements": out_elements,
        "_text_order": [e["text"] for e in all_elements],
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    converter = DocumentConverter()
    result = converter.convert(str(INPUT_PDF))
    doc = result.document

    page_elements = extract_page_elements(doc)

    pages_out = []
    all_text_lines: list[str] = []
    for page_no in sorted(page_elements.keys()):
        page_result = build_page_reading_order(page_no, page_elements[page_no])
        all_text_lines.extend(page_result.pop("_text_order"))
        pages_out.append(page_result)

    pages_json_path = OUTPUT_DIR / "pages.json"
    with pages_json_path.open("w", encoding="utf-8") as f:
        json.dump({"pages": pages_out}, f, indent=2, ensure_ascii=False)
        f.write("\n")

    reading_order_path = OUTPUT_DIR / "reading_order.txt"
    with reading_order_path.open("w", encoding="utf-8") as f:
        f.write("\n".join(all_text_lines))

    print(f"Wrote {pages_json_path}")
    print(f"Wrote {reading_order_path}")


if __name__ == "__main__":
    main()
