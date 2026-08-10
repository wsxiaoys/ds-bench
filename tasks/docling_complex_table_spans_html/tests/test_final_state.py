import collections
import json
import os
import subprocess
import xml.etree.ElementTree as ET

import pytest

PROJECT_DIR = "/home/user/project"
MAIN = os.path.join(PROJECT_DIR, "main.py")
INPUT_PDF = os.path.join(PROJECT_DIR, "assets", "complex_table.pdf")
HTML_PATH = os.path.join(PROJECT_DIR, "output", "table.html")
JSON_PATH = os.path.join(PROJECT_DIR, "output", "grid.json")

EXPECTED_ROWS = 5
EXPECTED_COLS = 4

# (row, col) -> expected trimmed text for every value the fixture guarantees.
EXPECTED_VALUES = {
    (1, 1): "Q1", (1, 2): "Q2", (1, 3): "Q3",
    (2, 0): "North", (2, 1): "10", (2, 2): "20", (2, 3): "30",
    (3, 0): "South", (3, 1): "40", (3, 2): "50", (3, 3): "60",
    (4, 0): "East", (4, 1): "70", (4, 2): "80", (4, 3): "90",
}

CELL_KEY_ORDER = ["row", "col", "rowspan", "colspan", "text", "is_header"]


def _run_tool(pdf, html_out, json_out):
    return subprocess.run(
        ["python", "main.py", "--pdf", pdf, "--html", html_out, "--json", json_out],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1200,
    )


@pytest.fixture(scope="module")
def happy_run():
    """Run the tool once on the fixture PDF; shared by the success-path tests."""
    for p in (HTML_PATH, JSON_PATH):
        if os.path.exists(p):
            os.remove(p)
    result = _run_tool("assets/complex_table.pdf", "output/table.html", "output/grid.json")
    print("STDOUT:\n" + result.stdout)
    print("STDERR:\n" + result.stderr)
    assert result.returncode == 0, (
        f"Tool exited with {result.returncode} on the happy path; stderr:\n{result.stderr}"
    )
    return result


@pytest.fixture(scope="module")
def grid_model(happy_run):
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        raw = f.read()
    return json.loads(raw, object_pairs_hook=collections.OrderedDict)


@pytest.fixture(scope="module")
def html_root(happy_run):
    with open(HTML_PATH, "rb") as f:
        data = f.read()
    return ET.fromstring(data)


# ---------------------------------------------------------------------------
# Basic artifacts
# ---------------------------------------------------------------------------

def test_main_script_exists():
    assert os.path.isfile(MAIN), f"Expected the agent to create {MAIN}."


def test_outputs_exist_and_non_empty(happy_run):
    for p in (HTML_PATH, JSON_PATH):
        assert os.path.isfile(p), f"Expected output file {p} to exist after running the tool."
        assert os.path.getsize(p) > 0, f"Output file {p} is empty."


# ---------------------------------------------------------------------------
# JSON grid model schema
# ---------------------------------------------------------------------------

def test_json_top_level_schema(grid_model):
    assert isinstance(grid_model, dict), "grid.json must be a single JSON object."
    assert list(grid_model.keys()) == ["num_rows", "num_cols", "cells"], (
        f"Top-level keys must be exactly ['num_rows','num_cols','cells'] in order, got {list(grid_model.keys())}."
    )
    assert isinstance(grid_model["num_rows"], int), "num_rows must be an integer."
    assert isinstance(grid_model["num_cols"], int), "num_cols must be an integer."
    assert isinstance(grid_model["cells"], list), "cells must be a JSON array."


def test_json_cell_schema_and_types(grid_model):
    for i, cell in enumerate(grid_model["cells"]):
        assert list(cell.keys()) == CELL_KEY_ORDER, (
            f"cells[{i}] keys must be exactly {CELL_KEY_ORDER} in order, got {list(cell.keys())}."
        )
        assert isinstance(cell["row"], int) and cell["row"] >= 0, f"cells[{i}].row must be a non-negative int."
        assert isinstance(cell["col"], int) and cell["col"] >= 0, f"cells[{i}].col must be a non-negative int."
        assert isinstance(cell["rowspan"], int) and cell["rowspan"] >= 1, f"cells[{i}].rowspan must be an int >= 1."
        assert isinstance(cell["colspan"], int) and cell["colspan"] >= 1, f"cells[{i}].colspan must be an int >= 1."
        assert isinstance(cell["text"], str), f"cells[{i}].text must be a string."
        assert isinstance(cell["is_header"], bool), f"cells[{i}].is_header must be a boolean."


def test_json_grid_dimensions(grid_model):
    assert grid_model["num_rows"] == EXPECTED_ROWS, (
        f"Expected num_rows == {EXPECTED_ROWS}, got {grid_model['num_rows']}."
    )
    assert grid_model["num_cols"] == EXPECTED_COLS, (
        f"Expected num_cols == {EXPECTED_COLS}, got {grid_model['num_cols']}."
    )


def test_json_cells_sorted_by_row_then_col(grid_model):
    anchors = [(c["row"], c["col"]) for c in grid_model["cells"]]
    assert anchors == sorted(anchors), (
        f"cells must be ordered ascending by row then col, got {anchors}."
    )


def test_json_full_non_overlapping_coverage(grid_model):
    nrows, ncols = grid_model["num_rows"], grid_model["num_cols"]
    occ = {}
    covered_area = 0
    for cell in grid_model["cells"]:
        r, c = cell["row"], cell["col"]
        rs, cs = cell["rowspan"], cell["colspan"]
        assert r + rs <= nrows, f"Cell at ({r},{c}) rowspan {rs} exceeds grid height {nrows}."
        assert c + cs <= ncols, f"Cell at ({r},{c}) colspan {cs} exceeds grid width {ncols}."
        covered_area += rs * cs
        for rr in range(r, r + rs):
            for cc in range(c, c + cs):
                assert (rr, cc) not in occ, f"Grid position ({rr},{cc}) is covered by more than one cell."
                occ[(rr, cc)] = True
    assert covered_area == nrows * ncols, (
        f"Sum of rowspan*colspan ({covered_area}) must equal num_rows*num_cols ({nrows * ncols})."
    )
    for rr in range(nrows):
        for cc in range(ncols):
            assert (rr, cc) in occ, f"Grid position ({rr},{cc}) is not covered by any cell."


def test_json_spanning_headers(grid_model):
    by_anchor = {(c["row"], c["col"]): c for c in grid_model["cells"]}
    region = by_anchor.get((0, 0))
    assert region is not None, "No logical cell anchored at (0,0)."
    assert region["text"].strip() == "Region", f"Cell at (0,0) must have text 'Region', got {region['text']!r}."
    assert region["rowspan"] == 2, f"'Region' header must have rowspan 2, got {region['rowspan']}."
    assert region["colspan"] == 1, f"'Region' header must have colspan 1, got {region['colspan']}."
    assert region["is_header"] is True, "'Region' cell must be marked is_header=true."

    sales = by_anchor.get((0, 1))
    assert sales is not None, "No logical cell anchored at (0,1)."
    assert sales["text"].strip() == "Sales", f"Cell at (0,1) must have text 'Sales', got {sales['text']!r}."
    assert sales["colspan"] == 3, f"'Sales' header must have colspan 3, got {sales['colspan']}."
    assert sales["is_header"] is True, "'Sales' cell must be marked is_header=true."


def test_json_known_values_at_coordinates(grid_model):
    by_anchor = {(c["row"], c["col"]): c for c in grid_model["cells"]}
    for (r, c), expected in EXPECTED_VALUES.items():
        cell = by_anchor.get((r, c))
        assert cell is not None, f"No logical cell anchored at ({r},{c}); expected text {expected!r}."
        assert cell["text"].strip() == expected, (
            f"Cell at ({r},{c}) must have text {expected!r}, got {cell['text']!r}."
        )


# ---------------------------------------------------------------------------
# HTML normalized table
# ---------------------------------------------------------------------------

def test_html_root_is_table(html_root):
    tag = html_root.tag.split("}")[-1].lower()
    assert tag == "table", f"HTML root element must be <table>, got <{html_root.tag}>."


def _reconstruct_html_grid(root):
    """Walk <tr>/<th>/<td> honouring rowspan/colspan; return dict[(r,c)] -> anchor info."""
    occupied = set()
    anchors = {}
    r = 0
    for tr in root.iter("tr"):
        c = 0
        for cell in list(tr):
            tag = cell.tag.split("}")[-1].lower()
            if tag not in ("td", "th"):
                continue
            while (r, c) in occupied:
                c += 1
            rowspan = int(cell.get("rowspan", "1"))
            colspan = int(cell.get("colspan", "1"))
            text = "".join(cell.itertext()).strip()
            anchors[(r, c)] = {"tag": tag, "text": text, "rowspan": rowspan, "colspan": colspan}
            for rr in range(r, r + rowspan):
                for cc in range(c, c + colspan):
                    occupied.add((rr, cc))
            c += colspan
        r += 1
    nrows = r
    ncols = (max(cc for _, cc in occupied) + 1) if occupied else 0
    return anchors, nrows, ncols


def test_html_reconstructs_expected_grid(html_root):
    anchors, nrows, ncols = _reconstruct_html_grid(html_root)
    assert nrows == EXPECTED_ROWS, f"HTML reconstructs {nrows} rows, expected {EXPECTED_ROWS}."
    assert ncols == EXPECTED_COLS, f"HTML reconstructs {ncols} columns, expected {EXPECTED_COLS}."


def test_html_spanning_headers(html_root):
    anchors, _, _ = _reconstruct_html_grid(html_root)
    region = anchors.get((0, 0))
    assert region is not None, "HTML has no cell anchored at (0,0)."
    assert region["text"] == "Region", f"HTML cell (0,0) must be 'Region', got {region['text']!r}."
    assert region["tag"] == "th", "HTML 'Region' cell must be a <th>."
    assert region["rowspan"] == 2, f"HTML 'Region' must carry rowspan=2, got {region['rowspan']}."

    sales = anchors.get((0, 1))
    assert sales is not None, "HTML has no cell anchored at (0,1)."
    assert sales["text"] == "Sales", f"HTML cell (0,1) must be 'Sales', got {sales['text']!r}."
    assert sales["tag"] == "th", "HTML 'Sales' cell must be a <th>."
    assert sales["colspan"] == 3, f"HTML 'Sales' must carry colspan=3, got {sales['colspan']}."


def test_html_known_values_at_coordinates(html_root):
    anchors, _, _ = _reconstruct_html_grid(html_root)
    for (r, c), expected in EXPECTED_VALUES.items():
        cell = anchors.get((r, c))
        assert cell is not None, f"HTML has no cell anchored at ({r},{c}); expected {expected!r}."
        assert cell["text"] == expected, (
            f"HTML cell at ({r},{c}) must be {expected!r}, got {cell['text']!r}."
        )


def test_html_and_json_agree(grid_model, html_root):
    json_anchors = {(c["row"], c["col"]): c["text"].strip() for c in grid_model["cells"]}
    html_anchors, _, _ = _reconstruct_html_grid(html_root)
    for coord, info in html_anchors.items():
        if info["text"] == "":
            continue
        assert coord in json_anchors, f"HTML has a cell at {coord} absent from the JSON grid."
        assert json_anchors[coord] == info["text"], (
            f"Text mismatch at {coord}: HTML {info['text']!r} vs JSON {json_anchors[coord]!r}."
        )


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

def test_missing_input_exits_2_and_writes_nothing():
    err_html = os.path.join(PROJECT_DIR, "output", "e.html")
    err_json = os.path.join(PROJECT_DIR, "output", "e.json")
    for p in (err_html, err_json):
        if os.path.exists(p):
            os.remove(p)
    result = _run_tool("assets/does_not_exist.pdf", "output/e.html", "output/e.json")
    assert result.returncode == 2, (
        f"Missing input must exit with code 2, got {result.returncode}; stderr:\n{result.stderr}"
    )
    assert not os.path.exists(err_html), "No HTML output must be written when the input PDF is missing."
    assert not os.path.exists(err_json), "No JSON output must be written when the input PDF is missing."
