#!/usr/bin/env python3
"""Docling Figure Taxonomy & Caption Cross-Reference Report.

Converts assets/report.pdf with picture classification enrichment enabled,
generates a JSON taxonomy report, a Markdown summary, and cropped figure PNGs.
"""

import base64
import io
import json
import os
from pathlib import Path

from PIL import Image

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption


def normalize_bbox(l, t, r, b, page_width, page_height):
    """Convert BOTTOMLEFT bbox to normalized top-left-origin coordinates.

    Docling returns bounding boxes with CoordOrigin.BOTTOMLEFT, meaning:
      - l = left (x0)
      - b = bottom (y0, distance from bottom)
      - r = right (x1)
      - t = top (y1, distance from bottom)

    We convert to normalized coordinates where (0,0) is top-left:
      x0 = l / page_width
      y0 = (page_height - t) / page_height   (top edge in top-left coords)
      x1 = r / page_width
      y1 = (page_height - b) / page_height   (bottom edge in top-left coords)
    """
    x0 = l / page_width
    y0 = (page_height - t) / page_height
    x1 = r / page_width
    y1 = (page_height - b) / page_height
    # Ensure x0 < x1 and y0 < y1
    if x0 > x1:
        x0, x1 = x1, x0
    if y0 > y1:
        y0, y1 = y1, y0
    return {
        "x0": round(x0, 6),
        "y0": round(y0, 6),
        "x1": round(x1, 6),
        "y1": round(y1, 6),
    }


def save_figure_image(pic, output_dir):
    """Decode the base64 data-URL image from a PictureItem and save as PNG."""
    img_ref = pic.image
    if img_ref is None or img_ref.uri is None:
        return None
    data_url = str(img_ref.uri)
    if "," not in data_url:
        return None
    b64_data = data_url.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_data)
    pil_img = Image.open(io.BytesIO(img_bytes))
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"figure_{len(list(output_dir.glob('*.png')))}.png"
    pil_img.save(str(path), "PNG")
    return path


def main():
    project_dir = Path(__file__).resolve().parent
    input_pdf = project_dir / "assets" / "report.pdf"
    output_dir = project_dir / "output"
    figures_dir = output_dir / "figures"

    # Clean previous outputs
    if output_dir.exists():
        import shutil

        shutil.rmtree(str(output_dir))
    output_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    # Configure pipeline with picture classification
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_picture_classification = True
    pipeline_options.generate_picture_images = True
    pipeline_options.images_scale = 2.0

    format_options = PdfFormatOption(pipeline_options=pipeline_options)
    converter = DocumentConverter(
        format_options={InputFormat.PDF: format_options}
    )

    # Convert document
    result = converter.convert(str(input_pdf))
    doc = result.document

    figures = {}
    class_groups = {}  # class_label -> list of figure indices

    for idx, pic in enumerate(doc.pictures):
        prov = pic.prov[0]
        page_no = prov.page_no
        page = doc.pages[page_no]
        page_w = page.size.width
        page_h = page.size.height

        # Classification
        meta = pic.meta
        if meta and meta.classification and meta.classification.predictions:
            top_pred = meta.classification.predictions[0]
            class_label = top_pred.class_name
            confidence = round(top_pred.confidence, 6)
        else:
            class_label = ""
            confidence = 0.0

        # Caption
        caption = pic.caption_text(doc)
        if caption is None:
            caption = ""

        # Normalized bounding box (convert from BOTTOMLEFT)
        bbox = normalize_bbox(
            prov.bbox.l, prov.bbox.t, prov.bbox.r, prov.bbox.b, page_w, page_h
        )

        # Save cropped image
        image_path = save_figure_image(pic, figures_dir)
        rel_image_path = (
            str(image_path.relative_to(project_dir)) if image_path else ""
        )

        figures[str(idx)] = {
            "class_label": class_label,
            "confidence": confidence,
            "page_no": page_no,
            "bbox": bbox,
            "caption": caption,
            "image_path": rel_image_path,
        }

        # Group by class for summary
        if class_label not in class_groups:
            class_groups[class_label] = []
        class_groups[class_label].append(idx)

    # Build JSON report
    report = {
        "source_pdf": "assets/report.pdf",
        "figure_count": len(doc.pictures),
        "figures": figures,
    }

    json_path = output_dir / "taxonomy_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Build Markdown summary
    md_lines = [
        "# Figure Taxonomy Summary",
        "",
        f"**Source PDF:** `{report['source_pdf']}`",
        f"**Total Figures:** {report['figure_count']}",
        "",
    ]

    for class_label in sorted(class_groups.keys()):
        md_lines.append(f"## {class_label}")
        md_lines.append("")
        for fig_idx in class_groups[class_label]:
            fig = figures[str(fig_idx)]
            md_lines.append(
                f"- **Figure {fig_idx}** (page {fig['page_no']}, "
                f"confidence: {fig['confidence']:.4f})"
            )
            if fig["caption"]:
                md_lines.append(f"  - Caption: *{fig['caption']}*")
            md_lines.append(
                f"  - Image: `{fig['image_path']}`"
            )
        md_lines.append("")

    md_path = output_dir / "taxonomy_summary.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    print(f"Report written to {json_path}")
    print(f"Summary written to {md_path}")
    print(f"Figures saved to {figures_dir}/")
    print(f"Detected {report['figure_count']} figures across "
          f"{len(class_groups)} classes: {sorted(class_groups.keys())}")


if __name__ == "__main__":
    main()
