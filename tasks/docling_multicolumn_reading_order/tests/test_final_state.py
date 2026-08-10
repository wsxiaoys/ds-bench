import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/reading_order"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
PAGES_JSON = os.path.join(OUTPUT_DIR, "pages.json")
READING_TXT = os.path.join(OUTPUT_DIR, "reading_order.txt")

# The fixture PDF is generated at build time with US-Letter pages (points).
PAGE_W = 612.0
PAGE_H = 792.0
BBOX_TOL = 3.0

EXPECTED_COLUMN_COUNTS = [2, 2, 1]

HEADER_MARKER = "CONFIDENTIALHEADERMARK"
FOOTER_MARKER = "FOOTERMARKZ"
PAGE_MARKERS = ["PAGEONEMARK", "PAGETWOMARK", "PAGETHREEMARK"]

# Sentinel sentence typeset flowing from the bottom of page-1's left column into
# the top of its right column. Kept identical to the build-time fixture text.
SENTINEL = (
    "SENTINEL BEGIN the quick auburn vessel silently navigated beyond the "
    "northern archipelago while cartographers meticulously recorded every subtle "
    "contour of the uncharted coastline before dusk finally settled over the "
    "tranquil harbor SENTINEL END"
)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


@pytest.fixture(scope="session")
def run_solution():
    """Clean previous outputs and run the agent's solution once."""
    for path in (PAGES_JSON, READING_TXT):
        if os.path.exists(path):
            os.remove(path)

    result = subprocess.run(
        ["python3", "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
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
def pages(run_solution):
    assert os.path.isfile(PAGES_JSON), f"{PAGES_JSON} was not created."
    with open(PAGES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, dict), "pages.json must be a JSON object."
    assert "pages" in data, "pages.json must have a top-level 'pages' key."
    assert isinstance(data["pages"], list), "'pages' must be a list."
    return data["pages"]


@pytest.fixture(scope="session")
def reading_text(run_solution):
    assert os.path.isfile(READING_TXT), f"{READING_TXT} was not created."
    with open(READING_TXT, "r", encoding="utf-8") as f:
        return f.read()


def test_outputs_exist(run_solution):
    assert os.path.isfile(PAGES_JSON), f"Missing output file {PAGES_JSON}."
    assert os.path.getsize(PAGES_JSON) > 0, "pages.json is empty."
    assert os.path.isfile(READING_TXT), f"Missing output file {READING_TXT}."
    assert os.path.getsize(READING_TXT) > 0, "reading_order.txt is empty."


def test_three_pages_ascending(pages):
    assert len(pages) == 3, f"Expected exactly 3 pages, got {len(pages)}."
    page_nos = [p["page_no"] for p in pages]
    assert page_nos == [1, 2, 3], f"page_no values must be [1, 2, 3], got {page_nos}."


def test_page_object_keys(pages):
    for p in pages:
        assert set(p.keys()) == {"page_no", "column_count", "elements"}, (
            f"Page object keys must be exactly page_no/column_count/elements, got {sorted(p.keys())}."
        )
        assert isinstance(p["page_no"], int), "page_no must be an integer."
        assert isinstance(p["column_count"], int) and p["column_count"] >= 1, (
            f"column_count must be an int >= 1, got {p['column_count']!r}."
        )
        assert isinstance(p["elements"], list) and len(p["elements"]) >= 1, (
            f"Page {p['page_no']} must have a non-empty 'elements' list."
        )


def test_element_shape(pages):
    for p in pages:
        for el in p["elements"]:
            assert set(el.keys()) == {"id", "column", "bbox"}, (
                f"Element keys must be exactly id/column/bbox, got {sorted(el.keys())}."
            )
            assert isinstance(el["id"], str) and el["id"].startswith("#/"), (
                f"Element id must be a self-ref string starting with '#/', got {el['id']!r}."
            )
            assert isinstance(el["column"], int) and el["column"] >= 0, (
                f"Element column must be an int >= 0, got {el['column']!r}."
            )
            bbox = el["bbox"]
            assert (
                isinstance(bbox, list)
                and len(bbox) == 4
                and all(isinstance(v, (int, float)) for v in bbox)
            ), f"bbox must be a list of 4 numbers, got {bbox!r}."
            l, t, r, b = bbox
            assert l < r, f"bbox requires l < r, got {bbox!r}."
            assert t < b, f"bbox requires t < b (top-left origin), got {bbox!r}."


def test_bbox_within_page(pages):
    for p in pages:
        for el in p["elements"]:
            l, t, r, b = el["bbox"]
            assert -BBOX_TOL <= l and r <= PAGE_W + BBOX_TOL, (
                f"bbox x-range {l}..{r} outside page width {PAGE_W} on page {p['page_no']}."
            )
            assert -BBOX_TOL <= t and b <= PAGE_H + BBOX_TOL, (
                f"bbox y-range {t}..{b} outside page height {PAGE_H} on page {p['page_no']}."
            )


def test_column_index_within_count(pages):
    for p in pages:
        for el in p["elements"]:
            assert el["column"] < p["column_count"], (
                f"Element column {el['column']} >= column_count {p['column_count']} on page {p['page_no']}."
            )


def test_column_count_detection(pages):
    counts = [p["column_count"] for p in pages]
    assert counts == EXPECTED_COLUMN_COUNTS, (
        f"Detected column counts {counts} do not match expected {EXPECTED_COLUMN_COUNTS} "
        "(page1=title over 2 cols, page2=2 cols, page3=1 col)."
    )


def test_left_before_right(pages):
    for p in pages:
        cols = [el["column"] for el in p["elements"]]
        for i in range(1, len(cols)):
            assert cols[i] >= cols[i - 1], (
                f"Column values must be non-decreasing (left before right) on page "
                f"{p['page_no']}, got sequence {cols}."
            )


def test_vertical_order_within_column(pages):
    for p in pages:
        last_top = {}
        for el in p["elements"]:
            col = el["column"]
            top = el["bbox"][1]
            if col in last_top:
                assert top >= last_top[col] - 1.0, (
                    f"Within column {col} on page {p['page_no']}, element tops must be "
                    f"non-decreasing (top-to-bottom); saw {last_top[col]} then {top}."
                )
            last_top[col] = top


def test_header_marker_excluded(reading_text):
    assert HEADER_MARKER not in _norm(reading_text), (
        f"Header marker '{HEADER_MARKER}' must be excluded from reading_order.txt."
    )


def test_footer_marker_excluded(reading_text):
    assert FOOTER_MARKER not in _norm(reading_text), (
        f"Footer marker '{FOOTER_MARKER}' must be excluded from reading_order.txt."
    )


def test_page_number_footer_excluded(reading_text):
    normalized = _norm(reading_text)
    # The running footer reads e.g. "FOOTERMARKZ Page 1 of 3"; the page-number
    # portion must also be absent.
    for phrase in ("Page 1 of 3", "Page 2 of 3", "Page 3 of 3"):
        assert phrase not in normalized, (
            f"Running page-number text '{phrase}' must be excluded from reading_order.txt."
        )


def test_sentinel_contiguous(reading_text):
    normalized = _norm(reading_text)
    assert _norm(SENTINEL) in normalized, (
        "The sentinel sentence that spans the page-1 column break must appear as one "
        "contiguous, correctly-ordered run in reading_order.txt."
    )


def test_cross_page_ordering(reading_text):
    normalized = _norm(reading_text)
    positions = []
    for marker in PAGE_MARKERS:
        idx = normalized.find(marker)
        assert idx != -1, f"Body marker '{marker}' is missing from reading_order.txt."
        positions.append(idx)
    assert positions == sorted(positions), (
        f"Page body markers must appear in page order; got positions {positions} for {PAGE_MARKERS}."
    )


def test_minimum_element_count(pages):
    total = sum(len(p["elements"]) for p in pages)
    assert total >= 12, (
        f"Expected at least 12 kept elements across all pages, got {total}."
    )
