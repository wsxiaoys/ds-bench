import importlib.util
import os

PROJECT_DIR = "/home/user/project"
HTML_DIR = os.path.join(PROJECT_DIR, "assets", "html")
LOCAL_DIR = os.path.join(PROJECT_DIR, "assets", "local")

EXPECTED_FIXTURES = [
    "br_paragraph.html",
    "br_table.html",
    "dl_basic.html",
    "dl_multi_dd.html",
    "dl_orphan_dd.html",
    "dl_strong_dt.html",
    "furniture_footer.html",
    "nested_table_images.html",
    "nested_table_in_dd.html",
    "nested_table_in_li.html",
    "ol_default.html",
    "ol_start_0.html",
    "ol_start_2.html",
    "ol_start_foo.html",
    "ol_start_neg5.html",
    "pre_block.html",
    "table_rowspan_header.html",
]


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, (
        "The 'docling' package is not importable in this environment."
    )


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, (
        "The 'docling_core' package is not importable in this environment."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_html_fixture_dir_exists():
    assert os.path.isdir(HTML_DIR), (
        f"HTML fixture directory {HTML_DIR} does not exist."
    )


def test_all_html_fixtures_present_and_non_empty():
    for name in EXPECTED_FIXTURES:
        path = os.path.join(HTML_DIR, name)
        assert os.path.isfile(path), f"Expected HTML fixture {path} to exist."
        assert os.path.getsize(path) > 0, f"HTML fixture {path} is empty."


def test_no_unexpected_html_fixtures():
    found = sorted(n for n in os.listdir(HTML_DIR) if n.endswith(".html"))
    assert found == sorted(EXPECTED_FIXTURES), (
        f"Unexpected HTML fixture set in {HTML_DIR}: {found}"
    )


def test_local_resource_tree_exists():
    page = os.path.join(LOCAL_DIR, "page.html")
    png = os.path.join(LOCAL_DIR, "images", "tiny.png")
    svg = os.path.join(LOCAL_DIR, "images", "diagram.svg")
    assert os.path.isfile(page), f"Expected local resource page {page} to exist."
    assert os.path.isfile(png), f"Expected local image {png} to exist."
    assert os.path.isfile(svg), f"Expected local SVG {svg} to exist."


def test_local_png_is_png_and_small():
    png = os.path.join(LOCAL_DIR, "images", "tiny.png")
    with open(png, "rb") as handle:
        header = handle.read(8)
    assert header == b"\x89PNG\r\n\x1a\n", (
        f"Local image {png} does not look like a PNG file."
    )
    assert 0 < os.path.getsize(png) < 1024, (
        f"Local image {png} must be a non-empty file smaller than 1024 bytes."
    )


def test_solution_not_present_yet():
    main_py = os.path.join(PROJECT_DIR, "main.py")
    assert not os.path.exists(main_py), (
        f"{main_py} must not exist before the task is solved."
    )
