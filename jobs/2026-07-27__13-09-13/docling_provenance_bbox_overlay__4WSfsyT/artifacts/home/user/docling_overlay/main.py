#!/usr/bin/env python3
"""
Per-Page Layout Provenance Overlay Renderer for Docling.

Converts assets/report.pdf with Docling, renders page images at scale 2.0,
and produces per-page overlay PNGs + JSON manifests under output/.
"""

import json
import os

from PIL import Image, ImageDraw

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

IMAGE_SCALE = 2.0

SUPPORTED_TYPES = {
    "text":            "#1f77b4",
    "section_header":  "#d62728",
    "list_item":       "#2ca02c",
    "table":           "#ff7f0e",
    "picture":         "#9467bd",
    "caption":         "#8c564b",
}

INPUT_PDF = "assets/report.pdf"
OUTPUT_DIR = "output"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    """Convert a hex color string (e.g. '#1f77b4') to an (R, G, B) tuple."""
    h = hex_str.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def docling_bbox_to_pixel(bbox, page_height: float, scale: float):
    """
    Convert a Docling BoundingBox (BOTTOMLEFT origin) to pixel-space
    [x0, y0, x1, y1] with top-left origin, scaled by the given factor.
    """
    tl = bbox.to_top_left_origin(page_height)
    scaled = tl.scaled(scale)
    return [scaled.l, scaled.t, scaled.r, scaled.b]


def draw_rectangle(draw: ImageDraw.ImageDraw, bbox_px, color_rgb, width: int = 2):
    """Draw a rectangle outline on the given ImageDraw context."""
    x0, y0, x1, y1 = bbox_px
    # Draw each edge as a line to avoid anti-aliasing fill issues
    draw.rectangle([x0, y0, x1, y1], outline=color_rgb, width=width)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # --- 1. Set up Docling converter ---------------------------------------
    pipeline_opts = PdfPipelineOptions()
    pipeline_opts.images_scale = IMAGE_SCALE
    pipeline_opts.generate_page_images = True

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_opts),
        }
    )

    # --- 2. Convert the PDF ------------------------------------------------
    print(f"Converting {INPUT_PDF} ...")
    result = converter.convert(INPUT_PDF)
    doc = result.document

    # --- 3. Ensure output directory ----------------------------------------
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --- 4. Collect elements per page --------------------------------------
    # Build a dict: page_no -> list of element dicts
    pages_data: dict[int, list[dict]] = {}

    for item, _level in doc.iterate_items():
        label = item.label.value if hasattr(item.label, "value") else str(item.label)

        # Only process supported types
        if label not in SUPPORTED_TYPES:
            continue

        # Must have provenance
        if not hasattr(item, "prov") or not item.prov:
            continue

        element_id = item.self_ref
        color_hex = SUPPORTED_TYPES[label]
        color_rgb = hex_to_rgb(color_hex)

        for prov_entry in item.prov:
            page_no = prov_entry.page_no
            bbox = prov_entry.bbox

            # Get the page height for this page
            page = doc.pages.get(page_no)
            if page is None:
                continue
            page_height = page.size.height

            # Convert BOTTOMLEFT doc coords -> top-left pixel coords
            bbox_px = docling_bbox_to_pixel(bbox, page_height, IMAGE_SCALE)

            entry = {
                "id": element_id,
                "type": label,
                "bbox": bbox_px,
                "color": color_hex,
            }

            pages_data.setdefault(page_no, []).append(entry)

    # --- 5. Generate overlay PNGs and manifests per page -------------------
    for page_no, page in doc.pages.items():
        if page.image is None or page.image.pil_image is None:
            print(f"  Skipping page {page_no}: no rendered image available.")
            continue

        pil_image = page.image.pil_image
        img_width, img_height = pil_image.size

        # Copy the raster image for overlay drawing
        overlay = pil_image.copy()
        draw = ImageDraw.Draw(overlay)

        boxes_for_page = pages_data.get(page_no, [])

        for entry in boxes_for_page:
            draw_rectangle(draw, entry["bbox"], hex_to_rgb(entry["color"]))

        # Save overlay PNG
        png_path = os.path.join(OUTPUT_DIR, f"overlay_page_{page_no}.png")
        overlay.save(png_path)
        print(f"  Wrote {png_path} ({img_width}x{img_height})")

        # Build and save manifest JSON
        manifest = {
            "page_no": page_no,
            "image_width": img_width,
            "image_height": img_height,
            "boxes": boxes_for_page,
        }
        json_path = os.path.join(OUTPUT_DIR, f"overlay_page_{page_no}.json")
        with open(json_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print(f"  Wrote {json_path} ({len(boxes_for_page)} boxes)")

    print("Done.")


if __name__ == "__main__":
    main()
