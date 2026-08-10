#!/usr/bin/env python3
"""Figure taxonomy & caption cross-reference report with Docling.

Runs entirely offline using locally cached Docling model weights.

Produces:
  * output/taxonomy_report.json   - machine-readable figure taxonomy
  * output/taxonomy_summary.md    - human-readable Markdown grouped by class
  * output/figures/*.png          - cropped picture images (scale 2.0)
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

# --- Force offline operation before importing docling / transformers --------
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling_core.types.doc import DoclingDocument, PictureItem

# --- Paths ------------------------------------------------------------------
PROJECT_DIR = Path(__file__).resolve().parent
SOURCE_PDF = PROJECT_DIR / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"
FIGURES_DIR = OUTPUT_DIR / "figures"
REPORT_JSON = OUTPUT_DIR / "taxonomy_report.json"
SUMMARY_MD = OUTPUT_DIR / "taxonomy_summary.md"

# Relative paths written into the report (as required by the spec).
SOURCE_PDF_REL = "assets/report.pdf"
FIGURES_REL = "figures"


def _artifacts_path() -> str:
    """Locate the locally cached Docling model artifacts directory."""
    for var in ("DOCLING_ARTIFACTS_PATH", "DOCLING_SERVE_ARTIFACTS_PATH"):
        val = os.environ.get(var)
        if val and Path(val).is_dir():
            return val
    return "/opt/app-root/src/.cache/docling/models"


def _clamp01(value: float) -> float:
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return float(value)


def _top_classification(picture: PictureItem) -> tuple[str, float]:
    """Return (class_label, confidence) of the highest-confidence prediction.

    Predictions are stored on the picture's ``meta.classification`` field
    (the new location) and, for backwards compatibility, may also be present
    in ``annotations`` as ``PictureClassificationData``.
    """
    candidates: list[tuple[str, float]] = []

    # New-style meta field (preferred).
    meta = getattr(picture, "meta", None)
    classification = getattr(meta, "classification", None) if meta is not None else None
    if classification is not None and getattr(classification, "predictions", None):
        for pred in classification.predictions:
            candidates.append((str(pred.class_name), float(pred.confidence)))

    # Legacy annotations fallback.
    if not candidates:
        for ann in getattr(picture, "annotations", []) or []:
            predicted = getattr(ann, "predicted_classes", None)
            if predicted:
                for pred in predicted:
                    candidates.append((str(pred.class_name), float(pred.confidence)))

    if not candidates:
        return ("unknown", 0.0)

    # Top prediction = highest confidence (predictions are normally already
    # sorted descending, but we pick the max explicitly to be safe).
    class_label, confidence = max(candidates, key=lambda c: c[1])
    return class_label, confidence


def _normalized_bbox(picture: PictureItem, doc: DoclingDocument) -> dict[str, float]:
    """Normalized [0,1] bbox with x0<x1, y0<y1 (min/max corners)."""
    prov = picture.prov[0]
    page = doc.pages[prov.page_no]
    page_size = page.size
    norm = prov.bbox.normalized(page_size)
    x0 = _clamp01(min(norm.l, norm.r))
    x1 = _clamp01(max(norm.l, norm.r))
    y0 = _clamp01(min(norm.t, norm.b))
    y1 = _clamp01(max(norm.t, norm.b))
    # Guarantee strict ordering even under floating point edge cases.
    if x0 >= x1:
        x1 = min(1.0, x0 + 1e-6)
    if y0 >= y1:
        y1 = min(1.0, y0 + 1e-6)
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


def _save_picture_png(picture: PictureItem, doc: DoclingDocument,
                      dest: Path) -> None:
    """Crop the picture (rendered at image scale 2.0) and save as PNG."""
    img = picture.get_image(doc)
    if img is None:
        raise RuntimeError(
            f"Could not render an image for picture on page "
            f"{picture.prov[0].page_no if picture.prov else '?'}."
        )
    img = img.convert("RGB")
    img.save(dest, format="PNG")


def build_report() -> dict[str, Any]:
    artifacts = _artifacts_path()

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_picture_classification = True      # classification enrichment
    pipeline_options.generate_picture_images = True         # export picture images
    pipeline_options.generate_page_images = True            # page images for cropping
    pipeline_options.images_scale = 2.0                     # render scale for crops
    pipeline_options.do_ocr = False                         # text layer is embedded
    pipeline_options.do_table_structure = False             # not needed for taxonomy
    pipeline_options.artifacts_path = artifacts
    pipeline_options.enable_remote_services = False          # strictly offline

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )

    conv_result = converter.convert(str(SOURCE_PDF))
    doc = conv_result.document

    # Collect pictures in document reading order.
    pictures: list[PictureItem] = []
    for item, _level in doc.iterate_items(traverse_pictures=True):
        if isinstance(item, PictureItem):
            pictures.append(item)

    # (Re)create output directories so the run is idempotent / overwrites.
    if OUTPUT_DIR.exists():
        # Wipe only our managed artifacts, keep nothing stale.
        if FIGURES_DIR.exists():
            shutil.rmtree(FIGURES_DIR)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    figures: dict[str, dict[str, Any]] = {}
    for idx, picture in enumerate(pictures):
        class_label, confidence = _top_classification(picture)
        page_no = int(picture.prov[0].page_no) if picture.prov else 0
        bbox = _normalized_bbox(picture, doc) if picture.prov else {
            "x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0,
        }
        caption = picture.caption_text(doc) or ""

        png_name = f"figure_{idx}.png"
        png_path = FIGURES_DIR / png_name
        _save_picture_png(picture, doc, png_path)
        image_path = f"output/{FIGURES_REL}/{png_name}"

        figures[str(idx)] = {
            "class_label": class_label,
            "confidence": confidence,
            "page_no": page_no,
            "bbox": bbox,
            "caption": caption,
            "image_path": image_path,
        }

    report = {
        "source_pdf": SOURCE_PDF_REL,
        "figure_count": len(pictures),
        "figures": figures,
    }
    return report


def write_json(report: dict[str, Any]) -> None:
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def write_markdown(report: dict[str, Any]) -> None:
    """Group figures by predicted class, referencing each by its index."""
    figures: dict[str, dict[str, Any]] = report["figures"]
    figure_count: int = report["figure_count"]

    # Preserve first-appearance order of class labels.
    class_to_indices: dict[str, list[int]] = {}
    for idx in range(figure_count):
        entry = figures[str(idx)]
        label = entry["class_label"]
        class_to_indices.setdefault(label, []).append(idx)

    lines: list[str] = []
    lines.append("# Figure Taxonomy Summary")
    lines.append("")
    lines.append(f"Source PDF: `{report['source_pdf']}`")
    lines.append(f"Total figures detected: **{figure_count}**")
    lines.append("")
    lines.append("Figures are grouped below by their predicted class label "
                 "(zero-based index assigned in document reading order).")
    lines.append("")

    if not class_to_indices:
        lines.append("_No figures detected._")
    else:
        lines.append("| Class label | Figure indices | Count |")
        lines.append("| --- | --- | --- |")
        for label, indices in class_to_indices.items():
            idx_str = ", ".join(str(i) for i in indices)
            lines.append(f"| {label} | {idx_str} | {len(indices)} |")
        lines.append("")

        for label, indices in class_to_indices.items():
            lines.append(f"## {label}")
            lines.append("")
            for i in indices:
                entry = figures[str(i)]
                lines.append(
                    f"- **Figure {i}** (page {entry['page_no']}, "
                    f"confidence {entry['confidence']:.4f}): "
                    f"{entry['caption'] if entry['caption'] else '_no caption_'}"
                )
            lines.append("")

    SUMMARY_MD.parent.mkdir(parents=True, exist_ok=True)
    with open(SUMMARY_MD, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def main() -> None:
    report = build_report()
    write_json(report)
    write_markdown(report)
    print(f"Wrote {REPORT_JSON.relative_to(PROJECT_DIR)} "
          f"({report['figure_count']} figures)")
    print(f"Wrote {SUMMARY_MD.relative_to(PROJECT_DIR)}")
    print(f"Cropped figure PNGs in {FIGURES_DIR.relative_to(PROJECT_DIR)}/")


if __name__ == "__main__":
    main()