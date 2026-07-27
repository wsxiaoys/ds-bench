#!/usr/bin/env python3
"""Per-page layout provenance overlay renderer for Docling.

Converts assets/report.pdf with Docling (page images enabled at scale 2.0)
and, for every page, writes:
  - output/overlay_page_<N>.png : the rendered page raster with one rectangle
    drawn per in-scope layout element (color-coded by element type).
  - output/overlay_page_<N>.json : a manifest describing every drawn box.
"""

import json
from pathlib import Path

from PIL import ImageDraw

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import DocItem

PROJECT_DIR = Path(__file__).resolve().parent
INPUT_PDF = PROJECT_DIR / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"

IMAGE_SCALE = 2.0

# Exact, case-insensitive hex color map for the six in-scope element types.
COLOR_MAP = {
    "text": "#1f77b4",
    "section_header": "#d62728",
    "list_item": "#2ca02c",
    "table": "#ff7f0e",
    "picture": "#9467bd",
    "caption": "#8c564b",
}

BOX_LINE_WIDTH = 2


def convert_document():
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_page_images = True
    pipeline_options.images_scale = IMAGE_SCALE

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )

    result = converter.convert(str(INPUT_PDF))
    return result.document


def collect_boxes_by_page(document):
    """Map page_no -> list of box records for the in-scope body elements."""
    boxes_by_page = {page_no: [] for page_no in document.pages.keys()}

    for item, _level in document.iterate_items():
        if not isinstance(item, DocItem):
            continue

        label = item.label.value
        if label not in COLOR_MAP:
            continue

        for prov in item.prov:
            page_no = prov.page_no
            page_item = document.pages.get(page_no)
            if page_item is None:
                continue

            page_height_pts = page_item.size.height
            # Scale the provenance bbox (in PDF-point, bottom-left-origin
            # space) to the raster image's pixel space, then flip to a
            # top-left origin to match the rendered raster.
            pixel_bbox = prov.bbox.scaled(scale=IMAGE_SCALE).to_top_left_origin(
                page_height=page_height_pts * IMAGE_SCALE
            )
            x0, y0, x1, y1 = pixel_bbox.as_tuple()

            # Guard against degenerate/out-of-range boxes.
            if x1 <= x0 or y1 <= y0:
                continue

            boxes_by_page.setdefault(page_no, []).append(
                {
                    "id": item.self_ref,
                    "type": label,
                    "bbox": [x0, y0, x1, y1],
                    "color": COLOR_MAP[label],
                }
            )

    return boxes_by_page


def render_overlays(document, boxes_by_page):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for page_no, page_item in sorted(document.pages.items()):
        if page_item.image is None:
            continue

        base_image = page_item.image.pil_image
        if base_image is None:
            continue

        overlay_image = base_image.convert("RGB").copy()
        draw = ImageDraw.Draw(overlay_image)

        image_width, image_height = overlay_image.size

        page_boxes = boxes_by_page.get(page_no, [])
        for box in page_boxes:
            x0, y0, x1, y1 = box["bbox"]
            # Clip to image bounds defensively; drawn rectangle should still
            # coincide with the element (values already in pixel space).
            x0c = max(0.0, min(x0, image_width))
            y0c = max(0.0, min(y0, image_height))
            x1c = max(0.0, min(x1, image_width))
            y1c = max(0.0, min(y1, image_height))
            draw.rectangle(
                [x0c, y0c, x1c, y1c],
                outline=box["color"],
                width=BOX_LINE_WIDTH,
            )

        png_path = OUTPUT_DIR / f"overlay_page_{page_no}.png"
        json_path = OUTPUT_DIR / f"overlay_page_{page_no}.json"

        overlay_image.save(png_path)

        manifest = {
            "page_no": page_no,
            "image_width": image_width,
            "image_height": image_height,
            "boxes": page_boxes,
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)


def main():
    document = convert_document()
    boxes_by_page = collect_boxes_by_page(document)
    render_overlays(document, boxes_by_page)


if __name__ == "__main__":
    main()
