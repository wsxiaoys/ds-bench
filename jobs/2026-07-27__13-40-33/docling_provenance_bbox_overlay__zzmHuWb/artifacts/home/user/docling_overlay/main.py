#!/usr/bin/env python3
"""Per-page layout provenance overlay renderer for Docling.

Converts ``assets/report.pdf`` with Docling (page-image rendering enabled at
image scale 2.0) and, for every page, writes an annotated overlay PNG plus a
machine-readable overlay manifest JSON into the ``output/`` directory.

Each layout-provenance bounding box carried by a document *body* element is
mapped from Docling's document/page coordinate system (PDF points, origin at
the bottom-left of the page) into the rendered raster's pixel space (origin at
the top-left, x right / y down) so that every drawn rectangle lands exactly on
top of the element it describes.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image, ImageDraw

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption


# --- configuration -----------------------------------------------------------

PROJECT_PATH = Path(__file__).resolve().parent
INPUT_PDF = PROJECT_PATH / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_PATH / "output"
IMAGE_SCALE = 2.0

# The six supported element types and the exact overlay color for each.
COLOR_MAP = {
    "text": "#1f77b4",
    "section_header": "#d62728",
    "list_item": "#2ca02c",
    "table": "#ff7f0e",
    "picture": "#9467bd",
    "caption": "#8c564b",
}
SUPPORTED_TYPES = set(COLOR_MAP.keys())


# --- helpers -----------------------------------------------------------------

def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert a ``#rrggbb`` hex string to an ``(r, g, b)`` tuple."""
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def box_to_pixels(bbox, page_size, img_w: int, img_h: int) -> list[float]:
    """Map a provenance BoundingBox into the raster pixel space (top-left origin).

    Docling provenance boxes are expressed in the PDF page coordinate system
    (points, bottom-left origin). We first convert to a top-left origin (still
    in points) and then scale to the rendered image's pixel dimensions, so the
    resulting box coincides with the element's true location in the raster.
    """
    page_height = float(page_size.height)

    # Normalize to a top-left origin (in points). This is a no-op if the box is
    # already in TOPLEFT origin; for BOTTOMLEFT it flips the y axis.
    tl = bbox.to_top_left_origin(page_height)

    sx = img_w / float(page_size.width)
    sy = img_h / float(page_size.height)

    x0 = tl.l * sx
    y0 = tl.t * sy
    x1 = tl.r * sx
    y1 = tl.b * sy

    # Guarantee the required ordering / bounds.
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0

    x0 = max(0.0, min(float(x0), float(img_w)))
    x1 = max(0.0, min(float(x1), float(img_w)))
    y0 = max(0.0, min(float(y0), float(img_h)))
    y1 = max(0.0, min(float(y1), float(img_h)))

    # Ensure a strictly-positive box even after clamping.
    if x1 <= x0:
        x1 = min(float(img_w), x0 + 1.0)
    if y1 <= y0:
        y1 = min(float(img_h), y0 + 1.0)

    return [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]


# --- main --------------------------------------------------------------------

def main() -> None:
    # Configure Docling: render page images at scale 2.0.
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_page_images = True
    pipeline_options.images_scale = IMAGE_SCALE

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )

    result = converter.convert(str(INPUT_PDF))
    doc = result.document

    # Group the in-scope body elements by the page each provenance box lives on.
    # An element may carry more than one provenance entry (e.g. spanning pages);
    # every provenance box must be drawn on its own page.
    per_page: dict[int, list[dict]] = {}

    for item, _level in doc.iterate_items():
        # Only document *body* elements are in scope (skip furniture/headers/etc).
        if str(item.content_layer) != "ContentLayer.BODY":
            continue

        label = item.label.value if hasattr(item.label, "value") else str(item.label)
        if label not in SUPPORTED_TYPES:
            continue

        self_ref = item.self_ref
        color = COLOR_MAP[label]

        for prov in item.prov:
            page_no = prov.page_no
            if page_no is None:
                continue
            per_page.setdefault(page_no, []).append(
                {
                    "id": self_ref,
                    "type": label,
                    "color": color,
                    "bbox": prov.bbox,
                }
            )

    # (Re)create the output directory and clear any stale overlay artifacts so
    # we never leave spurious files for pages that no longer exist.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUTPUT_DIR.glob("overlay_page_*.png"):
        stale.unlink()
    for stale in OUTPUT_DIR.glob("overlay_page_*.json"):
        stale.unlink()

    for page_no in sorted(doc.pages.keys()):
        page = doc.pages[page_no]
        if page.image is None or page.image.pil_image is None:
            # No raster for this page -> nothing to draw; still nothing spurious.
            continue

        base_img = page.image.pil_image
        img_w, img_h = base_img.size  # pixel dims of the scale-2.0 raster

        overlay = base_img.copy()
        if overlay.mode != "RGB":
            overlay = overlay.convert("RGB")
        draw = ImageDraw.Draw(overlay)

        boxes_manifest = []
        for entry in per_page.get(page_no, []):
            px_box = box_to_pixels(entry["bbox"], page.size, img_w, img_h)
            x0, y0, x1, y1 = px_box

            draw.rectangle(
                [x0, y0, x1, y1],
                outline=hex_to_rgb(entry["color"]),
                width=3,
            )

            boxes_manifest.append(
                {
                    "id": entry["id"],
                    "type": entry["type"],
                    "bbox": px_box,
                    "color": entry["color"],
                }
            )

        img_path = OUTPUT_DIR / f"overlay_page_{page_no}.png"
        json_path = OUTPUT_DIR / f"overlay_page_{page_no}.json"

        overlay.save(img_path)

        manifest = {
            "page_no": int(page_no),
            "image_width": int(img_w),
            "image_height": int(img_h),
            "boxes": boxes_manifest,
        }
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2)

        print(
            f"page {page_no}: wrote {img_path.name} ({img_w}x{img_h}) "
            f"with {len(boxes_manifest)} box(es) and {json_path.name}"
        )


if __name__ == "__main__":
    main()