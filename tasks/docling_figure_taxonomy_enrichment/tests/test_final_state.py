import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter

import pytest
from PIL import Image

PROJECT_DIR = "/home/user/project"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
REPORT_PATH = os.path.join(OUTPUT_DIR, "taxonomy_report.json")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "taxonomy_summary.md")
FIGURES_DIR = os.path.join(OUTPUT_DIR, "figures")
PDF_PATH = os.path.join(PROJECT_DIR, "assets", "report.pdf")

REQUIRED_TOP_KEYS = {"source_pdf", "figure_count", "figures"}
REQUIRED_FIGURE_KEYS = {
    "class_label",
    "confidence",
    "page_no",
    "bbox",
    "caption",
    "image_path",
}
REQUIRED_BBOX_KEYS = {"x0", "y0", "x1", "y1"}


def _norm_ws(text):
    return re.sub(r"\s+", " ", (text or "").strip())


@pytest.fixture(scope="session")
def run_solution():
    """Run the agent's CLI once, from a clean output state, and require success."""
    if os.path.isdir(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)

    env = os.environ.copy()
    result = subprocess.run(
        [sys.executable, "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
    )
    print("===== main.py STDOUT =====")
    print(result.stdout)
    print("===== main.py STDERR =====")
    print(result.stderr)
    assert result.returncode == 0, (
        f"`python3 main.py` exited with {result.returncode}. Stderr:\n{result.stderr}"
    )
    return result


@pytest.fixture(scope="session")
def report(run_solution):
    assert os.path.isfile(REPORT_PATH), f"Missing report file {REPORT_PATH}."
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, dict), "taxonomy_report.json must be a JSON object."
    return data


@pytest.fixture(scope="session")
def ground_truth(run_solution):
    """Independently convert the PDF with figure-classification enrichment to
    establish the ground-truth picture set (count, pages, captions, labels)."""
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.generate_picture_images = True
    opts.images_scale = 2.0
    opts.do_picture_classification = True

    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )
    doc = converter.convert(PDF_PATH).document

    pics = []
    all_labels = set()
    for pic in doc.pictures:
        page_no = pic.prov[0].page_no if pic.prov else None
        caption = pic.caption_text(doc)
        labels = []
        has_classif = False
        for ann in pic.annotations:
            preds = getattr(ann, "predicted_classes", None)
            if preds:
                has_classif = True
                for pred in preds:
                    labels.append(pred.class_name)
                    all_labels.add(pred.class_name)
        pics.append(
            {
                "page_no": page_no,
                "caption": caption,
                "has_classif": has_classif,
                "labels": labels,
            }
        )

    return {
        "count": len(doc.pictures),
        "pics": pics,
        "all_labels": all_labels,
    }


def test_output_artifacts_exist(report):
    assert os.path.isfile(REPORT_PATH), f"Missing {REPORT_PATH}."
    assert os.path.getsize(REPORT_PATH) > 0, "taxonomy_report.json is empty."
    assert os.path.isfile(SUMMARY_PATH), f"Missing {SUMMARY_PATH}."
    assert os.path.getsize(SUMMARY_PATH) > 0, "taxonomy_summary.md is empty."
    assert os.path.isdir(FIGURES_DIR), f"Missing figures directory {FIGURES_DIR}."


def test_report_top_level_schema(report):
    assert set(report.keys()) == REQUIRED_TOP_KEYS, (
        f"Top-level keys must be exactly {sorted(REQUIRED_TOP_KEYS)}, "
        f"got {sorted(report.keys())}."
    )
    assert report["source_pdf"] == "assets/report.pdf", (
        f"source_pdf must be 'assets/report.pdf', got {report['source_pdf']!r}."
    )
    assert isinstance(report["figure_count"], int) and not isinstance(
        report["figure_count"], bool
    ), "figure_count must be an integer."
    assert report["figure_count"] > 0, "figure_count must be a positive integer."
    assert isinstance(report["figures"], dict), "figures must be a JSON object."


def test_figures_keyed_by_zero_based_index(report):
    count = report["figure_count"]
    figures = report["figures"]
    assert len(figures) == count, (
        f"figures must contain exactly figure_count ({count}) entries, "
        f"got {len(figures)}."
    )
    expected_keys = {str(i) for i in range(count)}
    assert set(figures.keys()) == expected_keys, (
        f"figures must be keyed by decimal strings 0..{count - 1}; "
        f"got {sorted(figures.keys())}."
    )


def test_figure_count_matches_ground_truth(report, ground_truth):
    assert report["figure_count"] == ground_truth["count"], (
        f"figure_count ({report['figure_count']}) must equal the number of "
        f"pictures detected by Docling ({ground_truth['count']})."
    )


def test_every_picture_has_classification(ground_truth):
    assert ground_truth["count"] > 0, "Ground-truth conversion detected no pictures."
    missing = [i for i, p in enumerate(ground_truth["pics"]) if not p["has_classif"]]
    assert not missing, (
        f"Every picture must carry a classification annotation; pictures without "
        f"one (by ground-truth index): {missing}."
    )


def test_per_figure_schema_and_invariants(report):
    for key, fig in report["figures"].items():
        assert isinstance(fig, dict), f"figures[{key!r}] must be an object."
        assert set(fig.keys()) == REQUIRED_FIGURE_KEYS, (
            f"figures[{key!r}] keys must be exactly {sorted(REQUIRED_FIGURE_KEYS)}, "
            f"got {sorted(fig.keys())}."
        )

        assert isinstance(fig["class_label"], str) and fig["class_label"].strip(), (
            f"figures[{key!r}].class_label must be a non-empty string."
        )

        conf = fig["confidence"]
        assert isinstance(conf, (int, float)) and not isinstance(conf, bool), (
            f"figures[{key!r}].confidence must be a number."
        )
        assert 0.0 <= float(conf) <= 1.0, (
            f"figures[{key!r}].confidence must be within [0,1], got {conf}."
        )

        page_no = fig["page_no"]
        assert isinstance(page_no, int) and not isinstance(page_no, bool), (
            f"figures[{key!r}].page_no must be an integer."
        )
        assert page_no >= 1, (
            f"figures[{key!r}].page_no must be >= 1, got {page_no}."
        )

        bbox = fig["bbox"]
        assert isinstance(bbox, dict), f"figures[{key!r}].bbox must be an object."
        assert set(bbox.keys()) == REQUIRED_BBOX_KEYS, (
            f"figures[{key!r}].bbox keys must be exactly {sorted(REQUIRED_BBOX_KEYS)}, "
            f"got {sorted(bbox.keys())}."
        )
        for coord in REQUIRED_BBOX_KEYS:
            val = bbox[coord]
            assert isinstance(val, (int, float)) and not isinstance(val, bool), (
                f"figures[{key!r}].bbox.{coord} must be a number."
            )
            assert 0.0 <= float(val) <= 1.0, (
                f"figures[{key!r}].bbox.{coord} must be within [0,1], got {val}."
            )
        assert float(bbox["x0"]) < float(bbox["x1"]), (
            f"figures[{key!r}].bbox must satisfy x0 < x1."
        )
        assert float(bbox["y0"]) < float(bbox["y1"]), (
            f"figures[{key!r}].bbox must satisfy y0 < y1."
        )

        assert isinstance(fig["caption"], str), (
            f"figures[{key!r}].caption must be a string."
        )
        assert isinstance(fig["image_path"], str) and fig["image_path"].strip(), (
            f"figures[{key!r}].image_path must be a non-empty string."
        )


def test_page_numbers_match_ground_truth(report, ground_truth):
    report_pages = Counter(
        fig["page_no"] for fig in report["figures"].values()
    )
    truth_pages = Counter(
        p["page_no"] for p in ground_truth["pics"] if p["page_no"] is not None
    )
    assert report_pages == truth_pages, (
        f"The multiset of figure page numbers must match Docling's provenance. "
        f"Report: {dict(report_pages)}, ground truth: {dict(truth_pages)}."
    )


def test_class_labels_are_model_produced(report, ground_truth):
    valid_labels = ground_truth["all_labels"]
    assert valid_labels, "Ground-truth conversion produced no predicted class labels."
    for key, fig in report["figures"].items():
        assert fig["class_label"] in valid_labels, (
            f"figures[{key!r}].class_label {fig['class_label']!r} is not among the "
            f"labels the classifier actually produced ({sorted(valid_labels)}). "
            f"Labels must not be hardcoded."
        )


def test_captions_cross_reference(report, ground_truth):
    report_caps = Counter(
        _norm_ws(fig["caption"])
        for fig in report["figures"].values()
        if _norm_ws(fig["caption"])
    )
    truth_caps = Counter(
        _norm_ws(p["caption"])
        for p in ground_truth["pics"]
        if _norm_ws(p["caption"])
    )
    assert report_caps == truth_caps, (
        f"The multiset of non-empty captions must match Docling's picture captions. "
        f"Report: {dict(report_caps)}, ground truth: {dict(truth_caps)}."
    )


def test_cropped_images_valid(report):
    for key, fig in report["figures"].items():
        rel = fig["image_path"]
        abs_path = rel if os.path.isabs(rel) else os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(abs_path), (
            f"figures[{key!r}].image_path {rel!r} does not resolve to an existing file."
        )
        real = os.path.realpath(abs_path)
        assert real.startswith(os.path.realpath(FIGURES_DIR) + os.sep), (
            f"figures[{key!r}].image_path must live under output/figures/, got {rel!r}."
        )
        with Image.open(abs_path) as img:
            img.verify()
        with Image.open(abs_path) as img:
            assert img.format == "PNG", (
                f"figures[{key!r}] cropped image must be a PNG, got {img.format}."
            )
            width, height = img.size
        assert width >= 16 and height >= 16, (
            f"figures[{key!r}] cropped image is too small ({width}x{height}); "
            f"expected each dimension >= 16."
        )


def test_summary_groups_by_class(report):
    with open(SUMMARY_PATH, "r", encoding="utf-8") as f:
        summary = f.read()
    assert summary.strip(), "taxonomy_summary.md must not be empty."

    labels = {fig["class_label"] for fig in report["figures"].values()}
    for label in labels:
        assert label in summary, (
            f"taxonomy_summary.md must contain the class label {label!r} verbatim."
        )

    count = report["figure_count"]
    for i in range(count):
        assert re.search(rf"(?<!\d){i}(?!\d)", summary), (
            f"taxonomy_summary.md must reference figure index {i}."
        )
