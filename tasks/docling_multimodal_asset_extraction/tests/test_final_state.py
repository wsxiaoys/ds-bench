import glob
import os
import re
import shutil
import subprocess

import pytest
from PIL import Image

PROJECT_DIR = "/home/user/project"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
MAIN = os.path.join(PROJECT_DIR, "main.py")

# The input fixture (assets/report.pdf) is authored as a 2-page US-Letter
# document (612x792 pt) containing at least one clearly-ruled data table and
# at least one embedded figure.
EXPECTED_MIN_PAGES = 2
# US-Letter at 2x scale (~144 DPI) renders to roughly 1224x1584 px; a default
# (~72 DPI) render would only be ~612x792 px, so these thresholds prove the
# higher resolution while staying comfortably below the true 2x dimensions.
MIN_PAGE_WIDTH = 1000
MIN_PAGE_HEIGHT = 1300


@pytest.fixture(scope="session")
def run_solution():
    """Run the agent's solution end-to-end from a clean output directory."""
    assert os.path.isfile(MAIN), f"Expected solution entrypoint {MAIN} to exist."
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)

    result = subprocess.run(
        ["python", "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
    )
    print("=== main.py stdout ===")
    print(result.stdout)
    print("=== main.py stderr ===")
    print(result.stderr)
    assert result.returncode == 0, (
        f"`python main.py` failed with exit code {result.returncode}.\n"
        f"stderr:\n{result.stderr}"
    )
    assert os.path.isdir(OUTPUT_DIR), (
        f"Output directory {OUTPUT_DIR} was not created by the solution."
    )
    return result


def _indexed_files(pattern_prefix, suffix):
    """Return the contiguous 1-based indices n for which
    <OUTPUT_DIR>/<prefix><n><suffix> exists (stopping at the first gap)."""
    found = []
    n = 1
    while True:
        path = os.path.join(OUTPUT_DIR, f"{pattern_prefix}{n}{suffix}")
        if os.path.isfile(path):
            found.append(n)
            n += 1
        else:
            break
    return found


def test_tables_exported_csv_and_html(run_solution):
    csv_indices = _indexed_files("table_", ".csv")
    assert len(csv_indices) >= 1, (
        "Expected at least one table exported as output/table_<n>.csv "
        "(1-based, contiguous), but found none."
    )
    for n in csv_indices:
        csv_path = os.path.join(OUTPUT_DIR, f"table_{n}.csv")
        html_path = os.path.join(OUTPUT_DIR, f"table_{n}.html")

        assert os.path.getsize(csv_path) > 0, f"{csv_path} is empty."
        assert os.path.isfile(html_path), (
            f"Table {n} exported to CSV but matching {html_path} is missing."
        )
        assert os.path.getsize(html_path) > 0, f"{html_path} is empty."

        with open(csv_path, newline="", encoding="utf-8") as fp:
            import csv as _csv

            rows = [row for row in _csv.reader(fp) if any(c.strip() for c in row)]
        assert len(rows) >= 1, f"{csv_path} has no data rows."
        assert max(len(r) for r in rows) >= 2, (
            f"{csv_path} does not look like a table (fewer than 2 columns)."
        )

        with open(html_path, encoding="utf-8") as fp:
            html = fp.read().lower()
        assert "<table" in html, f"{html_path} does not contain an HTML <table>."


def test_pictures_cropped(run_solution):
    pic_indices = _indexed_files("picture_", ".png")
    assert len(pic_indices) >= 1, (
        "Expected at least one figure exported as output/picture_<n>.png "
        "(1-based, contiguous), but found none."
    )

    # Determine the smallest full-page render area for the crop-size comparison.
    page_paths = sorted(glob.glob(os.path.join(OUTPUT_DIR, "page_*.png")))
    assert page_paths, "No page renders found to compare picture crop sizes against."
    min_page_area = None
    for p in page_paths:
        with Image.open(p) as im:
            area = im.width * im.height
        min_page_area = area if min_page_area is None else min(min_page_area, area)

    for n in pic_indices:
        pic_path = os.path.join(OUTPUT_DIR, f"picture_{n}.png")
        with Image.open(pic_path) as im:
            im.verify()
        with Image.open(pic_path) as im:
            w, h = im.width, im.height
            assert im.format == "PNG", f"{pic_path} is not a PNG (got {im.format})."
        assert w >= 16 and h >= 16, (
            f"{pic_path} is a trivial image ({w}x{h}); expected a real figure crop."
        )
        assert (w * h) < min_page_area, (
            f"{pic_path} ({w}x{h}) is not smaller than a full page render; "
            "it should be a crop of only the figure region."
        )


def test_pages_rendered_at_2x(run_solution):
    page_indices = _indexed_files("page_", ".png")
    assert len(page_indices) >= 1, (
        "Expected at least one page render as output/page_<n>.png (1-based, "
        "contiguous), but found none."
    )
    assert len(page_indices) >= EXPECTED_MIN_PAGES, (
        f"Expected at least {EXPECTED_MIN_PAGES} page renders (the fixture PDF "
        f"has {EXPECTED_MIN_PAGES} pages), found {len(page_indices)}."
    )
    for n in page_indices:
        page_path = os.path.join(OUTPUT_DIR, f"page_{n}.png")
        with Image.open(page_path) as im:
            im.verify()
        with Image.open(page_path) as im:
            w, h = im.width, im.height
            assert im.format == "PNG", f"{page_path} is not a PNG (got {im.format})."
        assert w >= MIN_PAGE_WIDTH and h >= MIN_PAGE_HEIGHT, (
            f"{page_path} is {w}x{h}px; a 2x (~144 DPI) render of a US-Letter "
            f"page should be at least {MIN_PAGE_WIDTH}x{MIN_PAGE_HEIGHT}px. "
            "This looks like a default-resolution render."
        )


def test_markdown_uses_external_image_references(run_solution):
    md_path = os.path.join(OUTPUT_DIR, "document.md")
    assert os.path.isfile(md_path), f"{md_path} does not exist."
    assert os.path.getsize(md_path) > 0, f"{md_path} is empty."

    with open(md_path, encoding="utf-8") as fp:
        md = fp.read()

    assert "data:image" not in md, (
        "document.md contains inline base64 image data ('data:image'); images "
        "must be externally referenced files, not embedded."
    )

    image_refs = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", md)
    external_refs = [r.strip() for r in image_refs if not r.strip().lower().startswith("data:")]
    assert external_refs, (
        "document.md contains no Markdown image reference pointing to an image "
        "file on disk."
    )

    resolved_exists = []
    for ref in external_refs:
        target = ref.split()[0].strip("<>\"'")
        candidate = target if os.path.isabs(target) else os.path.join(OUTPUT_DIR, target)
        if os.path.isfile(candidate):
            resolved_exists.append(candidate)
    assert resolved_exists, (
        "None of the external image references in document.md resolve to a file "
        f"that exists on disk (relative to {OUTPUT_DIR}). References found: "
        f"{external_refs}"
    )
