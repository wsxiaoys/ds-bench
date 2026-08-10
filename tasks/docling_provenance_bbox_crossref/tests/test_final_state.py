import json
import math
import os
import subprocess
from collections import Counter

import pytest
from PIL import Image

PROJECT_DIR = "/home/user/project"
PDF_REL = "assets/report.pdf"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
ANNOTATIONS_PATH = os.path.join(OUTPUT_DIR, "annotations.json")

PAGE_WIDTH = 612.0
PAGE_HEIGHT = 792.0
EDGE_TOL = 2.0

EXPECTED_PAGE_IMAGES = [
    "pages/page_1.png",
    "pages/page_2.png",
    "pages/page_3.png",
    "pages/page_4.png",
]

# Seed fill colors baked into each figure -> its unique caption code.
FIGURE_COLOR_TO_CODE = {
    (200, 30, 30): "FIGCODE-RA1",
    (30, 160, 60): "FIGCODE-LB2",
    (40, 80, 200): "FIGCODE-MC3",
    (230, 160, 20): "FIGCODE-HD4",
}
# Tables are identified by the page they live on.
TABLE_PAGE_TO_CODE = {3: "TBLCODE-TT1", 4: "TBLCODE-EB2"}

ALL_CODES = [
    "FIGCODE-RA1",
    "FIGCODE-LB2",
    "FIGCODE-MC3",
    "FIGCODE-HD4",
    "TBLCODE-TT1",
    "TBLCODE-EB2",
]

TOP_LEVEL_KEYS = ["source_pdf", "image_scale", "page_count", "page_images", "elements"]
ELEMENT_KEYS = [
    "index",
    "element_type",
    "page_no",
    "bbox",
    "coord_origin",
    "crop_image_path",
    "caption_text",
]
BBOX_KEYS = ["left", "top", "right", "bottom"]


def _run_tool(pdf, output_dir, scale):
    return subprocess.run(
        [
            "python",
            "main.py",
            "--pdf",
            pdf,
            "--output-dir",
            output_dir,
            "--image-scale",
            str(scale),
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
    )


@pytest.fixture(scope="module")
def happy_run():
    if os.path.isdir(OUTPUT_DIR):
        import shutil

        shutil.rmtree(OUTPUT_DIR)
    result = _run_tool(PDF_REL, "output", 2.0)
    assert result.returncode == 0, (
        "Tool did not exit 0 on the happy path.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    return result


@pytest.fixture(scope="module")
def annotations(happy_run):
    assert os.path.isfile(ANNOTATIONS_PATH), (
        f"Annotations file {ANNOTATIONS_PATH} was not created."
    )
    with open(ANNOTATIONS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def _dominant_color(image_path):
    with Image.open(image_path) as im:
        im = im.convert("RGB")
        w, h = im.size
        cx0, cx1 = int(w * 0.35), max(int(w * 0.65), int(w * 0.35) + 1)
        cy0, cy1 = int(h * 0.35), max(int(h * 0.65), int(h * 0.35) + 1)
        patch = im.crop((cx0, cy0, cx1, cy1))
        colors = patch.getcolors(maxcolors=patch.size[0] * patch.size[1])
    assert colors, f"Could not read pixels from crop {image_path}."
    count, color = max(colors, key=lambda c: c[0])
    return color


def _nearest_figure_code(color):
    best_code = None
    best_dist = None
    for seed, code in FIGURE_COLOR_TO_CODE.items():
        dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(color, seed)))
        if best_dist is None or dist < best_dist:
            best_dist = dist
            best_code = code
    return best_code, best_dist


# --------------------------------------------------------------------------
# 1. Happy path
# --------------------------------------------------------------------------
def test_happy_path_exit_zero(happy_run):
    assert happy_run.returncode == 0, "Expected exit code 0 on successful run."


# --------------------------------------------------------------------------
# 2. Per-page PNGs
# --------------------------------------------------------------------------
def test_per_page_pngs_exist(happy_run):
    for rel in EXPECTED_PAGE_IMAGES:
        path = os.path.join(OUTPUT_DIR, rel)
        assert os.path.isfile(path), f"Expected page render {path} to exist."
        assert os.path.getsize(path) > 0, f"Page render {path} is empty."
        with Image.open(path) as im:
            im.verify()


# --------------------------------------------------------------------------
# 3. Top-level JSON shape
# --------------------------------------------------------------------------
def test_top_level_keys_and_order(annotations):
    assert isinstance(annotations, dict), "annotations.json must be a JSON object."
    assert list(annotations.keys()) == TOP_LEVEL_KEYS, (
        f"Top-level keys/order must be {TOP_LEVEL_KEYS}, got {list(annotations.keys())}."
    )


def test_top_level_values(annotations):
    assert annotations["source_pdf"] == PDF_REL, (
        f"source_pdf must be '{PDF_REL}', got {annotations['source_pdf']!r}."
    )
    assert float(annotations["image_scale"]) == 2.0, (
        f"image_scale must be 2.0, got {annotations['image_scale']!r}."
    )
    assert annotations["page_count"] == 4, (
        f"page_count must be 4, got {annotations['page_count']!r}."
    )
    assert annotations["page_images"] == EXPECTED_PAGE_IMAGES, (
        f"page_images must be {EXPECTED_PAGE_IMAGES}, got {annotations['page_images']!r}."
    )


# --------------------------------------------------------------------------
# 4. Element inventory
# --------------------------------------------------------------------------
def test_element_inventory(annotations):
    elements = annotations["elements"]
    assert isinstance(elements, list), "elements must be a JSON array."
    assert len(elements) == 6, f"Expected exactly 6 elements, got {len(elements)}."
    types = Counter(e["element_type"] for e in elements)
    assert types.get("figure") == 4, f"Expected 4 figures, got {types.get('figure')}."
    assert types.get("table") == 2, f"Expected 2 tables, got {types.get('table')}."
    pages = sorted(e["page_no"] for e in elements)
    assert pages == [2, 2, 3, 3, 4, 4], (
        f"Expected element pages multiset {{2,2,3,3,4,4}}, got {pages}."
    )


# --------------------------------------------------------------------------
# 5. Ordering, index, and per-element key order
# --------------------------------------------------------------------------
def test_element_keys_order(annotations):
    for i, e in enumerate(annotations["elements"]):
        assert list(e.keys()) == ELEMENT_KEYS, (
            f"Element {i} keys/order must be {ELEMENT_KEYS}, got {list(e.keys())}."
        )
        assert list(e["bbox"].keys()) == BBOX_KEYS, (
            f"Element {i} bbox keys/order must be {BBOX_KEYS}, got {list(e['bbox'].keys())}."
        )


def test_element_index_matches_position(annotations):
    for i, e in enumerate(annotations["elements"]):
        assert e["index"] == i, (
            f"Element at position {i} has index {e['index']}, expected {i}."
        )


def test_elements_sorted_by_page_then_top(annotations):
    elements = annotations["elements"]
    keys = [(e["page_no"], round(float(e["bbox"]["top"]), 3)) for e in elements]
    assert keys == sorted(keys), (
        f"elements must be ordered by (page_no, bbox.top ascending); got {keys}."
    )


# --------------------------------------------------------------------------
# 6. Bounding boxes well-formed and in-bounds
# --------------------------------------------------------------------------
def test_bboxes_wellformed_and_in_bounds(annotations):
    for e in annotations["elements"]:
        assert e["coord_origin"] == "TOPLEFT", (
            f"Element {e['index']} coord_origin must be 'TOPLEFT', got {e['coord_origin']!r}."
        )
        b = e["bbox"]
        left, top, right, bottom = (
            float(b["left"]),
            float(b["top"]),
            float(b["right"]),
            float(b["bottom"]),
        )
        assert left < right, f"Element {e['index']}: left ({left}) must be < right ({right})."
        assert top < bottom, f"Element {e['index']}: top ({top}) must be < bottom ({bottom})."
        assert -EDGE_TOL <= left and right <= PAGE_WIDTH + EDGE_TOL, (
            f"Element {e['index']}: horizontal bounds out of page [0,{PAGE_WIDTH}]: "
            f"left={left}, right={right}."
        )
        assert -EDGE_TOL <= top and bottom <= PAGE_HEIGHT + EDGE_TOL, (
            f"Element {e['index']}: vertical bounds out of page [0,{PAGE_HEIGHT}]: "
            f"top={top}, bottom={bottom}."
        )


# --------------------------------------------------------------------------
# 7. Crops exist and are well-named
# --------------------------------------------------------------------------
def test_crops_named_and_exist(annotations):
    elements = annotations["elements"]
    # compute expected rank within page (top-to-bottom)
    by_page = {}
    for e in elements:
        by_page.setdefault(e["page_no"], []).append(e)
    for page, elems in by_page.items():
        ordered = sorted(elems, key=lambda e: float(e["bbox"]["top"]))
        for rank, e in enumerate(ordered, start=1):
            expected = f"crops/{e['element_type']}_p{page}_{rank}.png"
            assert e["crop_image_path"] == expected, (
                f"Element {e['index']} crop_image_path must be {expected!r}, "
                f"got {e['crop_image_path']!r}."
            )
            path = os.path.join(OUTPUT_DIR, e["crop_image_path"])
            assert os.path.isfile(path), f"Crop image {path} does not exist."
            assert os.path.getsize(path) > 0, f"Crop image {path} is empty."
            with Image.open(path) as im:
                im.verify()


# --------------------------------------------------------------------------
# 8. Caption cross-reference correctness (figures via crop color)
# --------------------------------------------------------------------------
def test_figure_captions_correct(annotations):
    figures = [e for e in annotations["elements"] if e["element_type"] == "figure"]
    assert len(figures) == 4, f"Expected 4 figure elements, got {len(figures)}."
    seen_codes = set()
    for e in figures:
        crop = os.path.join(OUTPUT_DIR, e["crop_image_path"])
        color = _dominant_color(crop)
        code, dist = _nearest_figure_code(color)
        assert dist is not None and dist < 100.0, (
            f"Figure crop {crop} dominant color {color} does not match any seed figure "
            f"color (nearest={code}, dist={dist:.1f})."
        )
        caption = e["caption_text"]
        assert code in caption, (
            f"Figure identified as {code} (color {color}) must have caption containing "
            f"'{code}', but caption was {caption!r}. This indicates a mismatched/wrong "
            f"caption cross-reference."
        )
        for other in ALL_CODES:
            if other != code:
                assert other not in caption, (
                    f"Figure {code} caption {caption!r} unexpectedly contains another "
                    f"element's code {other!r}."
                )
        seen_codes.add(code)
    assert seen_codes == set(FIGURE_COLOR_TO_CODE.values()), (
        f"Not all figures were uniquely matched. Matched codes: {seen_codes}."
    )


# --------------------------------------------------------------------------
# 9. Caption cross-reference correctness (tables via page)
# --------------------------------------------------------------------------
def test_table_captions_correct(annotations):
    tables = [e for e in annotations["elements"] if e["element_type"] == "table"]
    assert len(tables) == 2, f"Expected 2 table elements, got {len(tables)}."
    seen_codes = set()
    for e in tables:
        page = e["page_no"]
        assert page in TABLE_PAGE_TO_CODE, (
            f"Table found on unexpected page {page}; expected one of {list(TABLE_PAGE_TO_CODE)}."
        )
        code = TABLE_PAGE_TO_CODE[page]
        caption = e["caption_text"]
        assert code in caption, (
            f"Table on page {page} must have caption containing '{code}', "
            f"but caption was {caption!r}."
        )
        for other in ALL_CODES:
            if other != code:
                assert other not in caption, (
                    f"Table {code} caption {caption!r} unexpectedly contains another "
                    f"element's code {other!r}."
                )
        seen_codes.add(code)
    assert seen_codes == set(TABLE_PAGE_TO_CODE.values()), (
        f"Not all tables were uniquely matched. Matched codes: {seen_codes}."
    )


# --------------------------------------------------------------------------
# 10 & 11. Error codes
# --------------------------------------------------------------------------
def test_missing_pdf_exit_code(happy_run):
    result = _run_tool("assets/does_not_exist.pdf", "output_missing", 2.0)
    assert result.returncode == 2, (
        "Expected exit code 2 when --pdf path does not exist, got "
        f"{result.returncode}.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )


def test_invalid_scale_exit_code(happy_run):
    result = _run_tool(PDF_REL, "output_badscale", 0)
    assert result.returncode == 3, (
        "Expected exit code 3 when --image-scale is not positive, got "
        f"{result.returncode}.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
