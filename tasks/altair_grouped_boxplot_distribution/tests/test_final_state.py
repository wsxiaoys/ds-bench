import csv
import json
import os

import pytest

PROJECT_DIR = "/home/user/altair_boxplot"
DATA_CSV = os.path.join(PROJECT_DIR, "data", "measurements.csv")
OUTPUT_HTML = os.path.join(PROJECT_DIR, "output", "grouped_boxplot.html")


def _read_html():
    assert os.path.isfile(OUTPUT_HTML), f"Expected output HTML artifact not found at {OUTPUT_HTML}."
    with open(OUTPUT_HTML, encoding="utf-8") as f:
        html = f.read()
    assert html.strip(), f"Output HTML {OUTPUT_HTML} is empty."
    return html


def _extract_spec(html):
    """Recover the embedded Vega-Lite spec by scanning for JSON objects.

    Altair embeds the spec inside the HTML as a JavaScript object literal. We
    walk every '{' in the document, attempt to decode a JSON value there with
    json.JSONDecoder.raw_decode, and keep the largest decoded object that looks
    like a Vega/Vega-Lite spec (contains a "$schema" key).
    """
    decoder = json.JSONDecoder()
    best = None
    best_len = -1
    idx = html.find("{")
    while idx != -1:
        try:
            obj, end = decoder.raw_decode(html, idx)
        except (ValueError, json.JSONDecodeError):
            idx = html.find("{", idx + 1)
            continue
        if isinstance(obj, dict) and "$schema" in obj:
            size = end - idx
            if size > best_len:
                best, best_len = obj, size
        # advance past this object to keep scanning for others
        idx = html.find("{", idx + 1)
    assert best is not None, "Could not locate an embedded Vega-Lite spec (with a '$schema' key) in the HTML."
    return best


def _iter_dicts(obj):
    """Yield every dict found anywhere within a nested JSON structure."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _iter_dicts(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from _iter_dicts(item)


def _find_boxplot_mark(spec):
    """Find a mark definition object of type 'boxplot' anywhere in the spec."""
    for d in _iter_dicts(spec):
        mark = d.get("mark")
        if isinstance(mark, dict) and mark.get("type") == "boxplot":
            return mark, d
        if mark == "boxplot":
            return {"type": "boxplot"}, d
    return None, None


@pytest.fixture(scope="module")
def html_text():
    return _read_html()


@pytest.fixture(scope="module")
def spec(html_text):
    return _extract_spec(html_text)


def test_html_artifact_exists_and_uses_vega_embed(html_text):
    assert "vegaEmbed" in html_text, (
        "The output HTML does not reference 'vegaEmbed'; it does not look like an Altair-saved chart."
    )
    assert '"$schema"' in html_text, "The output HTML does not contain an embedded spec with a '$schema' key."


def test_spec_contains_no_remote_url(spec):
    # A local-only chart inlines its data and must not reference a remote data URL.
    # (Note: the spec's own "$schema" value is a URL and is expected/allowed.)
    for d in _iter_dicts(spec):
        assert "url" not in d, (
            "The spec references a data 'url'; data must be embedded locally with no remote URL. "
            f"Offending object keys: {list(d.keys())}"
        )


def test_boxplot_mark_properties(spec):
    mark, _ = _find_boxplot_mark(spec)
    assert mark is not None, "No mark of type 'boxplot' was found in the spec."
    assert mark.get("type") == "boxplot", f"Mark type must be 'boxplot', found: {mark.get('type')!r}."
    assert mark.get("extent") == 2, f"Box-plot whisker extent must be the number 2, found: {mark.get('extent')!r}."
    assert mark.get("size") == 40, f"Box-plot size must be 40, found: {mark.get('size')!r}."
    assert bool(mark.get("ticks")), f"Box-plot whisker end-cap ticks must be enabled, found: {mark.get('ticks')!r}."


def test_encodings(spec):
    mark, container = _find_boxplot_mark(spec)
    assert container is not None, "No box-plot mark container found in the spec."
    encoding = container.get("encoding")
    assert isinstance(encoding, dict), "The box-plot mark has no encoding block."

    # x encoding
    x = encoding.get("x")
    assert isinstance(x, dict), "Missing 'x' encoding on the box-plot."
    assert x.get("field") == "alloy", f"x encoding must map to field 'alloy', found: {x.get('field')!r}."
    x_axis = x.get("axis") or {}
    assert x_axis.get("title") == "Alloy Grade", (
        f"x axis title must be exactly 'Alloy Grade', found: {x_axis.get('title')!r}."
    )

    # y encoding
    y = encoding.get("y")
    assert isinstance(y, dict), "Missing 'y' encoding on the box-plot."
    assert y.get("field") == "strength_mpa", (
        f"y encoding must map to field 'strength_mpa', found: {y.get('field')!r}."
    )
    y_axis = y.get("axis") or {}
    assert y_axis.get("title") == "Tensile Strength (MPa)", (
        f"y axis title must be exactly 'Tensile Strength (MPa)', found: {y_axis.get('title')!r}."
    )
    y_scale = y.get("scale") or {}
    assert y_scale.get("zero") is False, (
        f"y scale must set zero=false, found scale: {y_scale!r}."
    )

    # color encoding
    color = encoding.get("color")
    assert isinstance(color, dict), "Missing 'color' encoding on the box-plot."
    assert color.get("field") == "treatment", (
        f"color encoding must map to field 'treatment', found: {color.get('field')!r}."
    )

    # xOffset encoding (side-by-side dodge)
    x_offset = encoding.get("xOffset")
    assert isinstance(x_offset, dict), "Missing 'xOffset' encoding needed to dodge boxes side-by-side."
    assert x_offset.get("field") == "treatment", (
        f"xOffset encoding must map to field 'treatment', found: {x_offset.get('field')!r}."
    )


def test_faceted_by_supplier(spec):
    # The supplier facet may appear either as a 'column' encoding channel or as
    # a top-level facet structure. Accept any field=='supplier' used for faceting.
    found = False
    for d in _iter_dicts(spec):
        col = d.get("column")
        if isinstance(col, dict) and col.get("field") == "supplier":
            found = True
            break
        facet = d.get("facet")
        if isinstance(facet, dict):
            if facet.get("field") == "supplier":
                found = True
                break
            fcol = facet.get("column")
            if isinstance(fcol, dict) and fcol.get("field") == "supplier":
                found = True
                break
    assert found, "The chart must be faceted into one column per supplier (field 'supplier')."


def test_spec_is_renderable(spec):
    import vl_convert as vlc

    svg = vlc.vegalite_to_svg(json.dumps(spec))
    assert isinstance(svg, str) and svg.strip(), "vl-convert produced empty SVG output for the spec."
    assert svg.lstrip().startswith("<svg"), (
        "The extracted spec did not compile to a valid SVG; it is not a renderable Vega-Lite specification."
    )


def test_dataset_integrity():
    assert os.path.isfile(DATA_CSV), f"Input dataset {DATA_CSV} is missing."
    alloys, treatments, suppliers = set(), set(), set()
    with open(DATA_CSV, newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        for col in ("alloy", "treatment", "supplier", "strength_mpa"):
            assert col in header, f"Dataset missing column '{col}'. Found: {header}"
        for row in reader:
            alloys.add(row["alloy"])
            treatments.add(row["treatment"])
            suppliers.add(row["supplier"])
    assert len(alloys) == 3, f"Expected 3 distinct alloys, found {len(alloys)}: {sorted(alloys)}"
    assert len(treatments) == 2, f"Expected 2 distinct treatments, found {len(treatments)}: {sorted(treatments)}"
    assert len(suppliers) == 2, f"Expected 2 distinct suppliers, found {len(suppliers)}: {sorted(suppliers)}"
