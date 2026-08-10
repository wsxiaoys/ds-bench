#!/usr/bin/env python3
"""
Figure Taxonomy & Caption Cross-Reference Report with Docling.

Converts assets/report.pdf offline with Docling, using the picture/figure
classification enrichment model. For every detected picture we collect its
top predicted class + confidence, page number, normalized bounding box and
nearest caption, then crop and export the picture as a PNG. Results are
written as a machine readable JSON taxonomy report and a human readable
Markdown summary grouped by predicted class.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

# Make sure we never attempt any network access / remote downloads.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc.document import (
    DocItem,
    DocItemLabel,
    FloatingItem,
    PictureItem,
    TableItem,
)

PROJECT_ROOT = Path(__file__).resolve().parent
SOURCE_PDF_REL = "assets/report.pdf"
SOURCE_PDF = PROJECT_ROOT / SOURCE_PDF_REL

OUTPUT_DIR = PROJECT_ROOT / "output"
FIGURES_DIR = OUTPUT_DIR / "figures"

IMAGE_SCALE = 2.0


def build_converter() -> DocumentConverter:
    """Configure a DocumentConverter with picture classification enrichment."""
    pipeline_options = PdfPipelineOptions()

    # Enable the figure/picture classification model (offline, locally cached).
    pipeline_options.do_picture_classification = True

    # We need cropped picture images at the requested scale for both the
    # classification enrichment step and our own PNG export.
    pipeline_options.generate_picture_images = True
    pipeline_options.images_scale = IMAGE_SCALE

    # Keep table structure recognition on (default) so tables are correctly
    # separated from pictures; do not touch OCR / other defaults.

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


def normalized_bbox(picture: PictureItem, doc) -> dict:
    """Return the picture bbox normalized to [0, 1] against its page size,
    with x0,y0 the minimum (top-left) corner and x1,y1 the maximum
    (bottom-right) corner.
    """
    prov = picture.prov[0]
    page = doc.pages[prov.page_no]
    page_size = page.size

    bbox_top_left = prov.bbox.to_top_left_origin(page_height=page_size.height)
    bbox_norm = bbox_top_left.normalized(page_size)

    x0, y0, x1, y1 = bbox_norm.l, bbox_norm.t, bbox_norm.r, bbox_norm.b

    # Guard against any numerical edge cases / ordering issues.
    if x0 > x1:
        x0, x1 = x1, x0
    if y0 > y1:
        y0, y1 = y1, y0

    return {
        "x0": float(x0),
        "y0": float(y0),
        "x1": float(x1),
        "y1": float(y1),
    }


def top_prediction(picture: PictureItem):
    """Return (class_label, confidence) for the top classification prediction."""
    if picture.meta is not None and picture.meta.classification is not None:
        pred = picture.meta.classification.get_main_prediction()
        return pred.class_name, float(pred.confidence)
    return "Unclassified", 0.0


def build_caption_fallback_map(doc) -> dict:
    """Resolve a nearest-caption fallback for floating items (pictures and
    tables) that Docling's own caption/provenance linking did not associate
    with a caption.

    Docling's standard pipeline already links most captions via
    ``FloatingItem.captions``; this fallback only kicks in when that linking
    misses a pair (e.g. a stray/noise element sitting between a picture and
    its caption in reading order). We resolve the remaining unclaimed
    captions against the remaining unclaimed floating items with a greedy
    nearest-neighbor match in reading order, restricted to the same page,
    breaking distance ties in favor of "item precedes caption" (the
    convention used by every already-linked pair in this document).

    Returns a dict mapping id(floating_item) -> caption text.
    """
    flat_items = [item for item, _level in doc.iterate_items(with_groups=False)]

    claimed_refs: set[str] = set()
    unclaimed_floating: list[tuple[int, object, int]] = []  # (order_idx, item, page_no)
    for order_idx, item in enumerate(flat_items):
        if isinstance(item, FloatingItem) and isinstance(item, (PictureItem, TableItem)):
            if item.captions:
                for cap_ref in item.captions:
                    claimed_refs.add(cap_ref.cref)
            elif item.prov:
                unclaimed_floating.append((order_idx, item, item.prov[0].page_no))

    unclaimed_captions: list[tuple[int, str, str, int]] = []  # (order_idx, self_ref, text, page_no)
    for order_idx, item in enumerate(flat_items):
        if (
            isinstance(item, DocItem)
            and item.label == DocItemLabel.CAPTION
            and item.self_ref not in claimed_refs
            and item.prov
        ):
            text = getattr(item, "text", "") or ""
            unclaimed_captions.append(
                (order_idx, item.self_ref, text, item.prov[0].page_no)
            )

    # Build all same-page (floating_item, caption) candidate pairs, sorted by
    # (distance, tie_break) where tie_break prefers the item preceding its
    # caption over the item following its caption.
    pairs = []
    for f_idx, item, f_page in unclaimed_floating:
        for c_idx, self_ref, text, c_page in unclaimed_captions:
            if f_page != c_page:
                continue
            distance = abs(c_idx - f_idx)
            tie_break = 0 if f_idx < c_idx else 1
            pairs.append((distance, tie_break, f_idx, c_idx, id(item), self_ref, text))

    pairs.sort(key=lambda p: (p[0], p[1]))

    assigned_items: set[int] = set()
    assigned_captions: set[str] = set()
    fallback_map: dict[int, str] = {}

    for distance, tie_break, f_idx, c_idx, item_id, self_ref, text in pairs:
        if item_id in assigned_items or self_ref in assigned_captions:
            continue
        assigned_items.add(item_id)
        assigned_captions.add(self_ref)
        fallback_map[item_id] = text

    return fallback_map


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    converter = build_converter()
    result = converter.convert(str(SOURCE_PDF))
    doc = result.document

    # Collect pictures in document reading order.
    pictures = [
        item
        for item, _level in doc.iterate_items(traverse_pictures=False)
        if isinstance(item, PictureItem)
    ]

    fallback_captions = build_caption_fallback_map(doc)

    figures: dict[str, dict] = {}

    for idx, picture in enumerate(pictures):
        class_label, confidence = top_prediction(picture)

        prov = picture.prov[0]
        page_no = int(prov.page_no)

        bbox = normalized_bbox(picture, doc)
        caption = picture.caption_text(doc).strip()
        if not caption:
            caption = fallback_captions.get(id(picture), "").strip()

        image_rel_path = f"output/figures/figure_{idx}.png"
        image_abs_path = PROJECT_ROOT / image_rel_path

        pil_image = picture.get_image(doc)
        if pil_image is not None:
            pil_image.save(image_abs_path, format="PNG")
        else:
            # Should not happen since generate_picture_images is enabled, but
            # guard against it so the pipeline never crashes silently.
            raise RuntimeError(f"No image available for picture index {idx}")

        figures[str(idx)] = {
            "class_label": class_label,
            "confidence": confidence,
            "page_no": page_no,
            "bbox": bbox,
            "caption": caption,
            "image_path": image_rel_path,
        }

    report = {
        "source_pdf": SOURCE_PDF_REL,
        "figure_count": len(pictures),
        "figures": figures,
    }

    with open(OUTPUT_DIR / "taxonomy_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    write_markdown_summary(report)

    print(f"Detected {len(pictures)} figure(s).")
    print(f"Wrote {OUTPUT_DIR / 'taxonomy_report.json'}")
    print(f"Wrote {OUTPUT_DIR / 'taxonomy_summary.md'}")


def write_markdown_summary(report: dict) -> None:
    figures = report["figures"]

    # Group figure indices by class label, preserving first-seen order of
    # classes and ascending numeric order of indices within each class.
    groups: dict[str, list[int]] = {}
    for idx_str, entry in sorted(figures.items(), key=lambda kv: int(kv[0])):
        idx = int(idx_str)
        groups.setdefault(entry["class_label"], []).append(idx)

    lines = []
    lines.append("# Figure Taxonomy Summary")
    lines.append("")
    lines.append(f"Source PDF: `{report['source_pdf']}`")
    lines.append("")
    lines.append(f"Total figures detected: **{report['figure_count']}**")
    lines.append("")

    for class_label, indices in groups.items():
        lines.append(f"## {class_label}")
        lines.append("")
        lines.append(f"Count: {len(indices)}")
        lines.append("")
        for idx in indices:
            entry = figures[str(idx)]
            caption = entry["caption"] if entry["caption"] else "_(no caption)_"
            lines.append(
                f"- **Figure {idx}** (page {entry['page_no']}, "
                f"confidence {entry['confidence']:.3f}): {caption} "
                f"— `{entry['image_path']}`"
            )
        lines.append("")

    with open(OUTPUT_DIR / "taxonomy_summary.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


if __name__ == "__main__":
    main()
