#!/usr/bin/env python3
"""
Docling Figure/Table Provenance & Caption Cross-Referencing Tool.

Given a PDF, this tool (fully offline):
  1. Renders every page of the PDF to a PNG at a caller-specified scale.
  2. Locates every figure and every table, determines its layout
     provenance (page number + bounding box) and writes a cropped image
     of that element.
  3. Cross-references every figure/table with its caption text.

All results are written into a single ``annotations.json`` file plus the
page renders and element crops.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Render PDF pages, crop figures/tables, and cross-reference "
            "them with their captions."
        )
    )
    parser.add_argument("--pdf", required=True, help="Path to the input PDF.")
    parser.add_argument(
        "--output-dir", required=True, help="Directory to write all artifacts into."
    )
    parser.add_argument(
        "--image-scale",
        required=True,
        help="Positive float controlling the page/element render scale.",
    )
    # Parse manually (rather than type=float) so we can control the exit
    # code for invalid values (exit 3) instead of argparse's default (2).
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    pdf_arg = args.pdf
    pdf_path = Path(pdf_arg)
    if not pdf_path.exists():
        print(f"error: --pdf path does not exist: {pdf_arg}", file=sys.stderr)
        return 2

    try:
        image_scale = float(args.image_scale)
    except (TypeError, ValueError):
        print(
            f"error: --image-scale must be a positive number, got: {args.image_scale!r}",
            file=sys.stderr,
        )
        return 3
    if not (image_scale > 0) or not (image_scale == image_scale):  # NaN check
        print(
            f"error: --image-scale must be a positive number, got: {args.image_scale!r}",
            file=sys.stderr,
        )
        return 3
    import math

    if math.isinf(image_scale):
        print(
            f"error: --image-scale must be a positive number, got: {args.image_scale!r}",
            file=sys.stderr,
        )
        return 3

    output_dir = Path(args.output_dir)
    pages_dir = output_dir / "pages"
    crops_dir = output_dir / "crops"
    output_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)
    crops_dir.mkdir(parents=True, exist_ok=True)

    # Import docling lazily so that argument-validation errors (exit codes
    # 2 / 3) don't pay the cost of importing heavy ML dependencies.
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    pipeline_options = PdfPipelineOptions()
    pipeline_options.images_scale = image_scale
    pipeline_options.generate_page_images = True
    # Ensure no network access is ever attempted.
    pipeline_options.enable_remote_services = False
    pipeline_options.allow_external_plugins = False

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    result = converter.convert(str(pdf_path))
    doc = result.document

    page_count = len(doc.pages)

    # --- 1. Render every page to a PNG -------------------------------------
    page_images: list[str] = []
    for page_no in sorted(doc.pages.keys()):
        page = doc.pages[page_no]
        pil_image = page.image.pil_image
        rel_path = f"pages/page_{page_no}.png"
        pil_image.save(output_dir / rel_path)
        page_images.append(rel_path)

    # --- 2 & 3. Collect figures/tables with provenance + captions ----------
    raw_elements = []
    for picture in doc.pictures:
        raw_elements.append((picture, "figure"))
    for table in doc.tables:
        raw_elements.append((table, "table"))

    enriched = []
    for item, element_type in raw_elements:
        if not item.prov:
            continue
        prov = item.prov[0]
        page_no = prov.page_no
        page = doc.pages[page_no]
        page_height = page.size.height
        bbox_tl = prov.bbox.to_top_left_origin(page_height=page_height)

        caption_text = ""
        if item.captions:
            caption_item = item.captions[0].resolve(doc)
            caption_text = getattr(caption_item, "text", "") or ""

        enriched.append(
            {
                "item": item,
                "element_type": element_type,
                "page_no": page_no,
                "top": bbox_tl.t,
                "bbox": bbox_tl,
                "caption_text": caption_text,
            }
        )

    # Sort by ascending page number, then top-to-bottom (ascending top).
    enriched.sort(key=lambda e: (e["page_no"], e["top"]))

    # Assign 1-based rank within each page (top-to-bottom order).
    rank_by_page: dict[int, int] = {}
    elements_out = []
    for idx, entry in enumerate(enriched):
        page_no = entry["page_no"]
        rank_by_page[page_no] = rank_by_page.get(page_no, 0) + 1
        rank = rank_by_page[page_no]

        crop_rel_path = f"crops/{entry['element_type']}_p{page_no}_{rank}.png"
        crop_image = entry["item"].get_image(doc)
        crop_image.save(output_dir / crop_rel_path)

        bbox = entry["bbox"]
        elements_out.append(
            {
                "index": idx,
                "element_type": entry["element_type"],
                "page_no": page_no,
                "bbox": {
                    "left": float(bbox.l),
                    "top": float(bbox.t),
                    "right": float(bbox.r),
                    "bottom": float(bbox.b),
                },
                "coord_origin": "TOPLEFT",
                "crop_image_path": crop_rel_path,
                "caption_text": entry["caption_text"],
            }
        )

    annotations = {
        "source_pdf": pdf_arg,
        "image_scale": image_scale,
        "page_count": page_count,
        "page_images": page_images,
        "elements": elements_out,
    }

    with open(output_dir / "annotations.json", "w", encoding="utf-8") as f:
        json.dump(annotations, f, indent=2, ensure_ascii=False)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
