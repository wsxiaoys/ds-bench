import json
import os
import re
import shutil
import subprocess

import numpy as np
import pytest
from PIL import Image

PROJECT_DIR = "/home/user/docling_overlay"
INPUT_PDF = os.path.join(PROJECT_DIR, "assets", "report.pdf")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")

IMAGES_SCALE = 2.0

SIX_TYPES = {"text", "section_header", "list_item", "table", "picture", "caption"}
COLOR_MAP = {
    "text": "#1f77b4",
    "section_header": "#d62728",
    "list_item": "#2ca02c",
    "table": "#ff7f0e",
    "picture": "#9467bd",
    "caption": "#8c564b",
}

PNG_RE = re.compile(r"^overlay_page_(\d+)\.png$")
JSON_RE = re.compile(r"^overlay_page_(\d+)\.json$")


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def _label_value(item):
    label = getattr(item, "label", None)
    if label is None:
        return None
    return getattr(label, "value", str(label))


def _hex_to_rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _expected_pixel_bbox(bbox, page):
    """Transform a provenance bbox into top-left raster pixel space at the render scale."""
    img = page.image.pil_image
    iw, ih = img.size
    pw = float(page.size.width)
    ph = float(page.size.height)
    tl = bbox.to_top_left_origin(page_height=ph)
    sx = iw / pw
    sy = ih / ph
    xs = (tl.l * sx, tl.r * sx)
    ys = (tl.t * sy, tl.b * sy)
    return (min(xs), min(ys), max(xs), max(ys))


# --------------------------------------------------------------------------- #
# Session fixtures                                                             #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def solution_output():
    """Remove any prior artifacts and (re)run the agent's solution."""
    if os.path.isdir(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    result = subprocess.run(
        ["python3", "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
        timeout=1800,
    )
    print("=== main.py stdout ===\n" + (result.stdout or ""))
    print("=== main.py stderr ===\n" + (result.stderr or ""))
    assert result.returncode == 0, (
        f"`python3 main.py` failed with exit code {result.returncode}. stderr:\n{result.stderr}"
    )
    assert os.path.isdir(OUTPUT_DIR), f"Output directory {OUTPUT_DIR} was not created by main.py."
    return result


@pytest.fixture(scope="session")
def expected():
    """Independently convert the PDF and build the ground-truth expectation."""
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.images_scale = IMAGES_SCALE
    opts.generate_page_images = True
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )
    doc = converter.convert(INPUT_PDF).document

    # Per-page rendered image sizes.
    page_sizes = {}
    for page_no, page in doc.pages.items():
        assert page.image is not None and page.image.pil_image is not None, (
            f"Docling did not render a page image for page {page_no}."
        )
        page_sizes[int(page_no)] = page.image.pil_image.size  # (w, h)

    # Per-page expected in-scope elements.
    pages = {int(p): {} for p in doc.pages}
    largest = None  # (area, page_no, self_ref, expected_bbox, type)
    for item, _level in doc.iterate_items():
        prov = getattr(item, "prov", None)
        if not prov:
            continue
        lbl = _label_value(item)
        if lbl not in SIX_TYPES:
            continue
        ref = getattr(item, "self_ref", None)
        if not ref:
            continue
        for pr in prov:
            pno = int(pr.page_no)
            if pno not in pages:
                continue
            page = doc.pages[pno]
            ebbox = _expected_pixel_bbox(pr.bbox, page)
            pages[pno][ref] = {"type": lbl, "bbox": ebbox}
            area = pr.bbox.area()
            if largest is None or area > largest[0]:
                largest = (area, pno, ref, ebbox, lbl)

    return {
        "doc": doc,
        "page_numbers": sorted(int(p) for p in doc.pages),
        "page_sizes": page_sizes,
        "pages": pages,
        "largest": largest,
    }


def _load_manifest(page_no):
    path = os.path.join(OUTPUT_DIR, f"overlay_page_{page_no}.json")
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- #
# Tests                                                                        #
# --------------------------------------------------------------------------- #
def test_one_png_and_json_per_page(solution_output, expected):
    files = os.listdir(OUTPUT_DIR)
    png_pages = sorted(int(m.group(1)) for m in (PNG_RE.match(f) for f in files) if m)
    json_pages = sorted(int(m.group(1)) for m in (JSON_RE.match(f) for f in files) if m)
    want = expected["page_numbers"]
    assert png_pages == want, (
        f"Overlay PNG page numbers {png_pages} do not match document pages {want}."
    )
    assert json_pages == want, (
        f"Overlay manifest page numbers {json_pages} do not match document pages {want}."
    )


def test_overlay_dimensions(solution_output, expected):
    for page_no in expected["page_numbers"]:
        png_path = os.path.join(OUTPUT_DIR, f"overlay_page_{page_no}.png")
        assert os.path.isfile(png_path), f"Missing overlay PNG for page {page_no}."
        with Image.open(png_path) as im:
            png_size = im.size  # (w, h)
        exp_w, exp_h = expected["page_sizes"][page_no]
        assert png_size == (exp_w, exp_h), (
            f"Page {page_no} overlay dims {png_size} != rendered page image dims {(exp_w, exp_h)}."
        )
        page = expected["doc"].pages[page_no]
        assert abs(exp_w - page.size.width * IMAGES_SCALE) <= 2, (
            f"Page {page_no} width {exp_w} not consistent with point-width*{IMAGES_SCALE}."
        )
        assert abs(exp_h - page.size.height * IMAGES_SCALE) <= 2, (
            f"Page {page_no} height {exp_h} not consistent with point-height*{IMAGES_SCALE}."
        )
        manifest = _load_manifest(page_no)
        assert manifest.get("image_width") == exp_w and manifest.get("image_height") == exp_h, (
            f"Manifest image size for page {page_no} does not match the PNG dims {(exp_w, exp_h)}."
        )
        assert int(manifest.get("page_no")) == page_no, (
            f"Manifest page_no for page {page_no} is wrong: {manifest.get('page_no')}."
        )


def test_manifest_schema_and_box_validity(solution_output, expected):
    for page_no in expected["page_numbers"]:
        manifest = _load_manifest(page_no)
        assert isinstance(manifest.get("boxes"), list), f"'boxes' missing/not a list on page {page_no}."
        w = manifest["image_width"]
        h = manifest["image_height"]
        for entry in manifest["boxes"]:
            assert set(entry.keys()) == {"id", "type", "bbox", "color"}, (
                f"Box entry on page {page_no} has wrong keys: {sorted(entry.keys())}."
            )
            assert isinstance(entry["id"], str) and entry["id"], f"Bad id on page {page_no}."
            t = entry["type"]
            assert t in SIX_TYPES, f"Out-of-scope type '{t}' on page {page_no}."
            bbox = entry["bbox"]
            assert isinstance(bbox, list) and len(bbox) == 4, (
                f"bbox for {entry['id']} on page {page_no} must be a list of 4 numbers."
            )
            x0, y0, x1, y1 = (float(v) for v in bbox)
            assert 0 <= x0 < x1 <= w, f"x bounds violated for {entry['id']} on page {page_no}: {bbox}, w={w}."
            assert 0 <= y0 < y1 <= h, f"y bounds violated for {entry['id']} on page {page_no}: {bbox}, h={h}."
            assert str(entry["color"]).lower() == COLOR_MAP[t].lower(), (
                f"Color for type '{t}' on page {page_no} is {entry['color']}, expected {COLOR_MAP[t]}."
            )


def test_completeness_id_and_type_sets(solution_output, expected):
    for page_no in expected["page_numbers"]:
        manifest = _load_manifest(page_no)
        got_ids = {e["id"] for e in manifest["boxes"]}
        got_types = {e["id"]: e["type"] for e in manifest["boxes"]}
        exp = expected["pages"][page_no]
        exp_ids = set(exp.keys())
        assert got_ids == exp_ids, (
            f"Page {page_no} manifest ids differ from expected.\n"
            f"missing={sorted(exp_ids - got_ids)}\nextra={sorted(got_ids - exp_ids)}"
        )
        for ref, info in exp.items():
            assert got_types.get(ref) == info["type"], (
                f"Element {ref} on page {page_no} has type {got_types.get(ref)}, expected {info['type']}."
            )


def test_coordinate_transform_known_element(solution_output, expected):
    largest = expected["largest"]
    assert largest is not None, "No in-scope elements were found in the document."
    _area, page_no, ref, ebbox, _lbl = largest
    manifest = _load_manifest(page_no)
    match = next((e for e in manifest["boxes"] if e["id"] == ref), None)
    assert match is not None, f"Known largest element {ref} missing from page {page_no} manifest."
    got = [float(v) for v in match["bbox"]]
    for i, (g, e) in enumerate(zip(got, ebbox)):
        assert abs(g - e) <= 3.0, (
            f"Coordinate transform off for {ref} on page {page_no}, edge {i}: got {g}, expected {e} (tol 3px)."
        )


def test_color_mapping_consistent_and_drawn(solution_output, expected):
    # Global one-to-one type->color consistency across all pages.
    seen = {}
    for page_no in expected["page_numbers"]:
        manifest = _load_manifest(page_no)
        for entry in manifest["boxes"]:
            t = entry["type"]
            c = str(entry["color"]).lower()
            if t in seen:
                assert seen[t] == c, f"Type '{t}' mapped to multiple colors: {seen[t]} and {c}."
            else:
                seen[t] = c
    assert len(set(seen.values())) == len(seen), (
        f"Color mapping is not one-to-one across types: {seen}."
    )

    # Each drawn color really appears in the overlay, and overlays are annotated.
    for page_no in expected["page_numbers"]:
        manifest = _load_manifest(page_no)
        png_path = os.path.join(OUTPUT_DIR, f"overlay_page_{page_no}.png")
        with Image.open(png_path) as im:
            arr = np.asarray(im.convert("RGB"), dtype=np.int16)
        clean = expected["doc"].pages[page_no].image.pil_image.convert("RGB")
        clean_arr = np.asarray(clean, dtype=np.int16)
        if clean_arr.shape == arr.shape:
            assert not np.array_equal(clean_arr, arr), (
                f"Overlay for page {page_no} is identical to the unannotated page image (no boxes drawn)."
            )
        for color in {e["color"] for e in manifest["boxes"]}:
            target = np.array(_hex_to_rgb(color), dtype=np.int16)
            hit = np.any(np.all(np.abs(arr - target) <= 30, axis=-1))
            assert hit, f"Color {color} not found among pixels of overlay for page {page_no}."
