import collections
import json
import os
import shutil
import subprocess
import tempfile

import pytest

PROJECT_DIR = "/home/user/project"
MAIN = os.path.join(PROJECT_DIR, "main.py")
HTML_DIR = os.path.join(PROJECT_DIR, "assets", "html")
LOCAL_DIR = os.path.join(PROJECT_DIR, "assets", "local")
TINY_PNG = os.path.join(LOCAL_DIR, "images", "tiny.png")
REPORT = os.path.join(PROJECT_DIR, "output", "report.json")
PROBE_REPORT = "/tmp/audit_probe.json"
ALT_REPORT = "/tmp/audit_alt.json"
MISSING_REPORT = "/tmp/audit_missing.json"

EXPECTED_NAMES = [
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

DOC_KEYS = [
    "name",
    "body_lines",
    "body_blocks",
    "full_lines",
    "tables",
    "table_shapes",
    "table_cell_texts",
    "pictures",
]
RESOLUTION_KEYS = ["id", "outcome", "resolved", "error_type", "error_message"]
FETCH_KEYS = ["id", "outcome", "num_bytes", "error_type", "error_message"]
URL_KEYS = ["id", "url", "outcome", "error_type", "error_message"]

RESOLUTION_IDS = [
    "abs_posix",
    "file_uri",
    "fragment",
    "local_relative",
    "protocol_relative",
    "remote_relative",
    "remote_root_relative",
    "traversal",
    "traversal_sneaky",
    "windows_drive",
]
FETCH_IDS = [
    "data_uri_ok",
    "data_uri_too_large",
    "local_disabled",
    "local_enabled",
    "local_no_base_path",
    "remote_disabled",
    "svg_skipped",
]
URL_IDS = [
    "link_local_metadata",
    "loopback",
    "private_a",
    "private_c",
    "public_literal",
]


def _run_tool(html_dir, local_root, report):
    return subprocess.run(
        [
            "python",
            "main.py",
            "--html-dir",
            html_dir,
            "--local-root",
            local_root,
            "--report",
            report,
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
    )


def _load(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle, object_pairs_hook=collections.OrderedDict)


@pytest.fixture(scope="module")
def happy_run():
    for path in (REPORT, PROBE_REPORT, ALT_REPORT, MISSING_REPORT):
        if os.path.exists(path):
            os.remove(path)
    result = _run_tool("assets/html", "assets/local", "output/report.json")
    print("STDOUT:\n" + result.stdout)
    print("STDERR:\n" + result.stderr)
    assert result.returncode == 0, (
        f"Tool exited with {result.returncode} on the happy path; stderr:\n{result.stderr}"
    )
    return result


@pytest.fixture(scope="module")
def report(happy_run):
    return _load(REPORT)


@pytest.fixture(scope="module")
def docs(report):
    return {entry["name"]: entry for entry in report["documents"]}


def _probe(report, section, probe_id):
    for entry in report[section]:
        if entry["id"] == probe_id:
            return entry
    raise AssertionError(f"No entry with id {probe_id!r} in {section}.")


# ---------------------------------------------------------------------------
# 1. Artifacts and top-level schema
# ---------------------------------------------------------------------------


def test_main_script_exists():
    assert os.path.isfile(MAIN), f"Expected the agent to create {MAIN}."


def test_report_exists_and_non_empty(happy_run):
    assert os.path.isfile(REPORT), f"Expected report file {REPORT} to exist."
    assert os.path.getsize(REPORT) > 0, f"Report file {REPORT} is empty."


def test_report_top_level_schema(report):
    assert isinstance(report, dict), "The report must be a single JSON object."
    assert list(report.keys()) == [
        "documents",
        "resolution_probes",
        "fetch_probes",
        "url_safety_probes",
        "summary",
    ], (
        "Top-level keys must be exactly ['documents','resolution_probes','fetch_probes',"
        f"'url_safety_probes','summary'] in order, got {list(report.keys())}."
    )


# ---------------------------------------------------------------------------
# 2. Document inventory
# ---------------------------------------------------------------------------


def test_document_inventory(report):
    names = [entry["name"] for entry in report["documents"]]
    assert names == EXPECTED_NAMES, (
        f"documents must list the 17 fixtures ascending by name, got {names}."
    )


def test_document_entry_schema(report):
    for i, entry in enumerate(report["documents"]):
        assert list(entry.keys()) == DOC_KEYS, (
            f"documents[{i}] keys must be exactly {DOC_KEYS} in order, got {list(entry.keys())}."
        )
        assert isinstance(entry["name"], str), f"documents[{i}].name must be a string."
        for key in ("body_lines", "body_blocks", "full_lines"):
            assert isinstance(entry[key], list) and all(
                isinstance(x, str) for x in entry[key]
            ), f"documents[{i}].{key} must be an array of strings."
        assert isinstance(entry["tables"], int), f"documents[{i}].tables must be an int."
        assert isinstance(entry["pictures"], int), (
            f"documents[{i}].pictures must be an int."
        )
        assert isinstance(entry["table_shapes"], list), (
            f"documents[{i}].table_shapes must be an array."
        )
        assert len(entry["table_shapes"]) == entry["tables"], (
            f"documents[{i}].table_shapes must have one entry per table."
        )
        for shape in entry["table_shapes"]:
            assert (
                isinstance(shape, list)
                and len(shape) == 2
                and all(isinstance(v, int) for v in shape)
            ), f"documents[{i}].table_shapes entries must be [num_rows, num_cols] int pairs."
        assert isinstance(entry["table_cell_texts"], list), (
            f"documents[{i}].table_cell_texts must be an array."
        )
        assert len(entry["table_cell_texts"]) == entry["tables"], (
            f"documents[{i}].table_cell_texts must have one array per table."
        )
        for cells in entry["table_cell_texts"]:
            assert isinstance(cells, list) and all(
                isinstance(x, str) for x in cells
            ), f"documents[{i}].table_cell_texts entries must be arrays of strings."


# ---------------------------------------------------------------------------
# 3. Ordered-list start semantics
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name,expected",
    [
        ("ol_default.html", ["1. 1st item", "2. 2nd item"]),
        ("ol_start_2.html", ["2. 1st item", "3. 2nd item"]),
        ("ol_start_0.html", ["0. 1st item", "1. 2nd item"]),
        ("ol_start_neg5.html", ["1. 1st item", "2. 2nd item"]),
        ("ol_start_foo.html", ["1. 1st item", "2. 2nd item"]),
    ],
)
def test_ordered_list_start_semantics(docs, name, expected):
    assert docs[name]["body_lines"] == expected, (
        f"{name}: expected body_lines {expected}, got {docs[name]['body_lines']}."
    )


# ---------------------------------------------------------------------------
# 4. Description lists
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name,expected",
    [
        (
            "dl_basic.html",
            [
                "- **Coffee**",
                "    - Black hot drink",
                "- **Milk**",
                "    - White cold drink",
            ],
        ),
        (
            "dl_multi_dd.html",
            [
                "- **Python**",
                "    - A high-level programming language",
                "    - Known for simplicity",
            ],
        ),
        ("dl_strong_dt.html", ["- **HTML**", "    - HyperText Markup Language"]),
        (
            "dl_orphan_dd.html",
            ["- Orphan description 1", "- Orphan description 2"],
        ),
    ],
)
def test_description_lists(docs, name, expected):
    assert docs[name]["body_lines"] == expected, (
        f"{name}: expected body_lines {expected}, got {docs[name]['body_lines']}."
    )


# ---------------------------------------------------------------------------
# 5. Content-layer separation
# ---------------------------------------------------------------------------


def test_content_layer_separation(docs):
    entry = docs["furniture_footer.html"]
    assert entry["body_lines"] == ["# Main Heading", "Some Content"], (
        f"furniture_footer.html body_lines must contain only BODY content, got {entry['body_lines']}."
    )
    assert entry["full_lines"] == [
        "Initial content with some **bold text**",
        "# Main Heading",
        "Some Content",
        "Some Footer Content",
    ], (
        f"furniture_footer.html full_lines must include the furniture, got {entry['full_lines']}."
    )


# ---------------------------------------------------------------------------
# 6. Line-break semantics
# ---------------------------------------------------------------------------


def test_source_newlines_are_collapsed(docs):
    blocks = docs["br_paragraph.html"]["body_blocks"]
    assert (
        "This sentence is split across source newlines and must stay together." in blocks
    ), f"Source newlines must collapse into a single block, got {blocks}."


def test_single_br_is_a_line_break(docs):
    blocks = docs["br_paragraph.html"]["body_blocks"]
    assert "foo\nbar" in blocks, (
        f"A single <br> must produce one block 'foo\\nbar', got {blocks}."
    )
    assert "bar" not in blocks, (
        f"A single <br> must not split the paragraph into a separate 'bar' block, got {blocks}."
    )
    assert "Street 1\nCity" in blocks, (
        f"A single <br> in <address> must produce one block 'Street 1\\nCity', got {blocks}."
    )


def test_double_br_splits_paragraph(docs):
    blocks = docs["br_paragraph.html"]["body_blocks"]
    assert "alpha" in blocks and "beta" in blocks, (
        f"Two consecutive <br> must split the paragraph into 'alpha' and 'beta', got {blocks}."
    )
    assert blocks.index("beta") > blocks.index("alpha"), (
        f"'beta' must follow 'alpha' in document order, got {blocks}."
    )


def test_sentinel_characters_do_not_leak(docs):
    entry = docs["br_paragraph.html"]
    assert "Text with a pre-existing sentinelcharacter." in entry["body_blocks"], (
        f"Expected the sentinel-carrying paragraph to be cleaned, got {entry['body_blocks']}."
    )
    serialized = json.dumps(entry, ensure_ascii=False)
    assert "\ue000" not in serialized, (
        "The private-use character U+E000 must not appear anywhere in the br_paragraph.html entry."
    )


# ---------------------------------------------------------------------------
# 7. Preformatted text
# ---------------------------------------------------------------------------


def test_pre_block_preserves_newlines(docs):
    lines = docs["pre_block.html"]["body_lines"]
    assert "Line 1" in lines, f"pre_block.html body_lines must contain 'Line 1': {lines}"
    idx = lines.index("Line 1")
    assert lines[idx : idx + 3] == ["Line 1", "Line 2", "Line 3"], (
        f"<pre> must preserve its three lines consecutively, got {lines}."
    )


def test_html_title_is_furniture(docs):
    full_lines = docs["pre_block.html"]["full_lines"]
    assert full_lines and full_lines[0] == "# Preformatted", (
        f"The <title> must appear as the first furniture line, got {full_lines}."
    )
    assert "# Preformatted" not in docs["pre_block.html"]["body_lines"], (
        "The <title> must not appear in the BODY-only markdown."
    )


# ---------------------------------------------------------------------------
# 8. Line breaks inside table cells
# ---------------------------------------------------------------------------


def test_line_breaks_in_table_cells(docs):
    entry = docs["br_table.html"]
    assert entry["tables"] == 1, f"br_table.html must yield 1 table, got {entry['tables']}."
    assert entry["table_shapes"] == [[2, 2]], (
        f"br_table.html table must be 2x2, got {entry['table_shapes']}."
    )
    assert entry["table_cell_texts"][0] == [
        "Cell 1\nLine 2",
        "Plain",
        "Cell A\n\nCell B",
        "Plain 2",
    ], f"Unexpected cell texts for br_table.html: {entry['table_cell_texts'][0]!r}"


# ---------------------------------------------------------------------------
# 9-12. Nested tables, pictures, spanning headers
# ---------------------------------------------------------------------------


def test_nested_table_in_list_item(docs):
    entry = docs["nested_table_in_li.html"]
    assert entry["tables"] == 1, (
        f"The table nested in an <li> must be parsed as a table, got {entry['tables']} tables."
    )
    assert entry["table_shapes"] == [[2, 2]], (
        f"Nested table must be 2x2, got {entry['table_shapes']}."
    )
    lines = entry["body_lines"]
    for expected in ("1. First step.", "2. Second step:", "3. Third step."):
        assert expected in lines, (
            f"Ordered-list numbering must be preserved; missing {expected!r} in {lines}."
        )
    joined = "\n".join(lines)
    assert joined.count("Fault type.") == 1, (
        f"Cell text must not be duplicated into the list item; 'Fault type.' occurred "
        f"{joined.count('Fault type.')} times."
    )


def test_nested_table_in_description_list_item(docs):
    entry = docs["nested_table_in_dd.html"]
    assert entry["tables"] == 1, (
        f"The table nested in a <dd> must be parsed as a table, got {entry['tables']} tables."
    )
    assert entry["table_shapes"] == [[1, 2]], (
        f"Nested table must be 1x2, got {entry['table_shapes']}."
    )


def test_nested_tables_with_images(docs):
    entry = docs["nested_table_images.html"]
    assert entry["tables"] == 6, (
        f"nested_table_images.html must yield 6 tables, got {entry['tables']}."
    )
    assert entry["pictures"] == 6, (
        f"Each of the 6 <img> tags must yield exactly one picture, got {entry['pictures']}."
    )


def test_spanning_header_cells(docs):
    entry = docs["table_rowspan_header.html"]
    assert entry["tables"] == 1, (
        f"table_rowspan_header.html must yield 1 table, got {entry['tables']}."
    )
    assert entry["table_shapes"] == [[3, 3]], (
        f"The spanning table must be 3x3, got {entry['table_shapes']}."
    )
    assert entry["table_cell_texts"][0] == [
        "Region",
        "Sales",
        "Q1",
        "Q2",
        "North",
        "10",
        "20",
    ], f"Unexpected cell texts for table_rowspan_header.html: {entry['table_cell_texts'][0]!r}"


# ---------------------------------------------------------------------------
# 13. Resolution probes
# ---------------------------------------------------------------------------


def test_resolution_probe_inventory(report):
    ids = [entry["id"] for entry in report["resolution_probes"]]
    assert ids == RESOLUTION_IDS, (
        f"resolution_probes must contain exactly {RESOLUTION_IDS} ascending by id, got {ids}."
    )
    for i, entry in enumerate(report["resolution_probes"]):
        assert list(entry.keys()) == RESOLUTION_KEYS, (
            f"resolution_probes[{i}] keys must be exactly {RESOLUTION_KEYS} in order, "
            f"got {list(entry.keys())}."
        )


@pytest.mark.parametrize("probe_id", ["abs_posix", "file_uri", "windows_drive"])
def test_absolute_locations_are_rejected(report, probe_id):
    entry = _probe(report, "resolution_probes", probe_id)
    assert entry["outcome"] == "rejected", (
        f"{probe_id} must be rejected, got {entry['outcome']!r}."
    )
    assert entry["error_type"] == "ValueError", (
        f"{probe_id} must raise ValueError, got {entry['error_type']!r}."
    )
    assert "Absolute paths are not allowed with local base_path" in (
        entry["error_message"] or ""
    ), f"Unexpected error message for {probe_id}: {entry['error_message']!r}"
    assert entry["resolved"] is None, f"{probe_id} must have resolved=null."


@pytest.mark.parametrize("probe_id", ["traversal", "traversal_sneaky"])
def test_path_traversal_is_rejected(report, probe_id):
    entry = _probe(report, "resolution_probes", probe_id)
    assert entry["outcome"] == "rejected", (
        f"{probe_id} must be rejected, got {entry['outcome']!r}."
    )
    assert entry["error_type"] == "ValueError", (
        f"{probe_id} must raise ValueError, got {entry['error_type']!r}."
    )
    assert "Path traversal blocked" in (entry["error_message"] or ""), (
        f"Unexpected error message for {probe_id}: {entry['error_message']!r}"
    )
    assert entry["resolved"] is None, f"{probe_id} must have resolved=null."


@pytest.mark.parametrize(
    "probe_id,expected",
    [
        ("fragment", "#section-2"),
        ("protocol_relative", "https://cdn.example.com/img/a.png"),
        ("remote_relative", "https://cdn.example.com/docs/img/a.png"),
        ("remote_root_relative", "https://cdn.example.com/img/a.png"),
    ],
)
def test_resolved_locations(report, probe_id, expected):
    entry = _probe(report, "resolution_probes", probe_id)
    assert entry["outcome"] == "resolved", (
        f"{probe_id} must be resolved, got {entry['outcome']!r} ({entry['error_message']!r})."
    )
    assert entry["resolved"] == expected, (
        f"{probe_id} must resolve to {expected!r}, got {entry['resolved']!r}."
    )
    assert entry["error_type"] is None and entry["error_message"] is None, (
        f"{probe_id} must not carry error information."
    )


def test_local_relative_resolution(report):
    entry = _probe(report, "resolution_probes", "local_relative")
    expected = os.path.realpath(TINY_PNG)
    assert entry["outcome"] == "resolved", (
        f"local_relative must be resolved, got {entry['outcome']!r}."
    )
    assert os.path.realpath(entry["resolved"] or "") == expected, (
        f"local_relative must resolve to {expected}, got {entry['resolved']!r}."
    )


# ---------------------------------------------------------------------------
# 14. Fetch probes
# ---------------------------------------------------------------------------


def test_fetch_probe_inventory(report):
    ids = [entry["id"] for entry in report["fetch_probes"]]
    assert ids == FETCH_IDS, (
        f"fetch_probes must contain exactly {FETCH_IDS} ascending by id, got {ids}."
    )
    for i, entry in enumerate(report["fetch_probes"]):
        assert list(entry.keys()) == FETCH_KEYS, (
            f"fetch_probes[{i}] keys must be exactly {FETCH_KEYS} in order, got {list(entry.keys())}."
        )


@pytest.mark.parametrize("probe_id", ["data_uri_ok", "local_enabled"])
def test_allowed_image_loads(report, probe_id):
    entry = _probe(report, "fetch_probes", probe_id)
    assert entry["outcome"] == "loaded", (
        f"{probe_id} must load the image data, got {entry['outcome']!r} ({entry['error_message']!r})."
    )
    assert entry["num_bytes"] == os.path.getsize(TINY_PNG), (
        f"{probe_id} must report {os.path.getsize(TINY_PNG)} bytes, got {entry['num_bytes']!r}."
    )
    assert entry["error_type"] is None, f"{probe_id} must not carry error information."


def test_oversized_data_uri_is_blocked(report):
    entry = _probe(report, "fetch_probes", "data_uri_too_large")
    assert entry["outcome"] == "blocked", (
        f"data_uri_too_large must be blocked, got {entry['outcome']!r}."
    )
    assert entry["error_type"] == "ValueError", (
        f"data_uri_too_large must raise ValueError, got {entry['error_type']!r}."
    )
    assert "exceeds size limit" in (entry["error_message"] or ""), (
        f"Unexpected error message for data_uri_too_large: {entry['error_message']!r}"
    )
    assert entry["num_bytes"] is None, "data_uri_too_large must have num_bytes=null."


@pytest.mark.parametrize(
    "probe_id,fragment",
    [
        ("local_disabled", "Fetching local resources is only allowed when set explicitly"),
        ("local_no_base_path", "Local file access requires base_path"),
        (
            "remote_disabled",
            "Fetching remote resources is only allowed when set explicitly",
        ),
    ],
)
def test_blocked_fetches(report, probe_id, fragment):
    entry = _probe(report, "fetch_probes", probe_id)
    assert entry["outcome"] == "blocked", (
        f"{probe_id} must be blocked, got {entry['outcome']!r}."
    )
    assert entry["error_type"] == "OperationNotAllowed", (
        f"{probe_id} must raise OperationNotAllowed, got {entry['error_type']!r}."
    )
    assert fragment in (entry["error_message"] or ""), (
        f"Unexpected error message for {probe_id}: {entry['error_message']!r}"
    )
    assert entry["num_bytes"] is None, f"{probe_id} must have num_bytes=null."


def test_svg_source_is_skipped(report):
    entry = _probe(report, "fetch_probes", "svg_skipped")
    assert entry["outcome"] == "skipped", (
        f"svg_skipped must be skipped without data and without error, got {entry['outcome']!r} "
        f"({entry['error_message']!r})."
    )
    assert entry["num_bytes"] is None, "svg_skipped must have num_bytes=null."
    assert entry["error_type"] is None, "svg_skipped must not carry error information."


# ---------------------------------------------------------------------------
# 15. URL safety probes
# ---------------------------------------------------------------------------


def test_url_safety_probe_inventory(report):
    ids = [entry["id"] for entry in report["url_safety_probes"]]
    assert ids == URL_IDS, (
        f"url_safety_probes must contain exactly {URL_IDS} ascending by id, got {ids}."
    )
    for i, entry in enumerate(report["url_safety_probes"]):
        assert list(entry.keys()) == URL_KEYS, (
            f"url_safety_probes[{i}] keys must be exactly {URL_KEYS} in order, "
            f"got {list(entry.keys())}."
        )


@pytest.mark.parametrize(
    "probe_id", ["link_local_metadata", "loopback", "private_a", "private_c"]
)
def test_restricted_ips_are_rejected(report, probe_id):
    entry = _probe(report, "url_safety_probes", probe_id)
    assert entry["outcome"] == "rejected", (
        f"{probe_id} must be rejected, got {entry['outcome']!r}."
    )
    assert entry["error_type"] == "ValueError", (
        f"{probe_id} must raise ValueError, got {entry['error_type']!r}."
    )
    assert "Access to restricted IP address not allowed" in (
        entry["error_message"] or ""
    ), f"Unexpected error message for {probe_id}: {entry['error_message']!r}"


def test_public_ip_literal_is_allowed(report):
    entry = _probe(report, "url_safety_probes", "public_literal")
    assert entry["url"] == "https://93.184.216.34/image.png", (
        f"public_literal must record its url verbatim, got {entry['url']!r}."
    )
    assert entry["outcome"] == "allowed", (
        f"public_literal must be allowed, got {entry['outcome']!r} ({entry['error_message']!r})."
    )
    assert entry["error_type"] is None and entry["error_message"] is None, (
        "public_literal must not carry error information."
    )


# ---------------------------------------------------------------------------
# 16. Summary
# ---------------------------------------------------------------------------


def test_summary(report):
    summary = report["summary"]
    assert list(summary.keys()) == [
        "num_documents",
        "num_tables",
        "num_pictures",
        "num_rejected_resolutions",
        "num_blocked_fetches",
        "num_rejected_urls",
    ], f"Unexpected summary keys/order: {list(summary.keys())}."
    expected = {
        "num_documents": 17,
        "num_tables": 10,
        "num_pictures": 6,
        "num_rejected_resolutions": 5,
        "num_blocked_fetches": 4,
        "num_rejected_urls": 4,
    }
    assert dict(summary) == expected, f"Expected summary {expected}, got {dict(summary)}."


def test_summary_matches_arrays(report):
    summary = report["summary"]
    assert summary["num_documents"] == len(report["documents"])
    assert summary["num_tables"] == sum(d["tables"] for d in report["documents"])
    assert summary["num_pictures"] == sum(d["pictures"] for d in report["documents"])
    assert summary["num_rejected_resolutions"] == sum(
        1 for p in report["resolution_probes"] if p["outcome"] == "rejected"
    )
    assert summary["num_blocked_fetches"] == sum(
        1 for p in report["fetch_probes"] if p["outcome"] == "blocked"
    )
    assert summary["num_rejected_urls"] == sum(
        1 for p in report["url_safety_probes"] if p["outcome"] == "rejected"
    )


# ---------------------------------------------------------------------------
# 17-18. The tool must really audit whatever it is pointed at
# ---------------------------------------------------------------------------


def test_audits_a_different_corpus(happy_run):
    tmp_dir = tempfile.mkdtemp(prefix="audit_html_")
    try:
        with open(os.path.join(tmp_dir, "probe.html"), "w", encoding="utf-8") as handle:
            handle.write(
                '<html><body><ol start="7"><li>alpha</li><li>beta</li></ol></body></html>'
            )
        if os.path.exists(PROBE_REPORT):
            os.remove(PROBE_REPORT)
        result = _run_tool(tmp_dir, "assets/local", PROBE_REPORT)
        print("STDERR:\n" + result.stderr)
        assert result.returncode == 0, (
            f"Tool exited with {result.returncode} on the alternate corpus; stderr:\n{result.stderr}"
        )
        data = _load(PROBE_REPORT)
        assert len(data["documents"]) == 1, (
            f"Expected exactly one audited document, got {len(data['documents'])}."
        )
        entry = data["documents"][0]
        assert entry["name"] == "probe.html", (
            f"Expected the audited document to be named 'probe.html', got {entry['name']!r}."
        )
        assert entry["body_lines"] == ["7. alpha", "8. beta"], (
            f"Expected body_lines ['7. alpha', '8. beta'], got {entry['body_lines']}."
        )
        assert data["summary"]["num_documents"] == 1, (
            f"summary.num_documents must be 1, got {data['summary']['num_documents']}."
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_audits_a_different_local_tree(happy_run):
    from PIL import Image

    tmp_dir = tempfile.mkdtemp(prefix="audit_local_")
    try:
        images = os.path.join(tmp_dir, "images")
        os.makedirs(images, exist_ok=True)
        with open(os.path.join(tmp_dir, "page.html"), "w", encoding="utf-8") as handle:
            handle.write(
                '<html><body><h1>Alt Page</h1><p><img src="images/tiny.png"></p></body></html>'
            )
        with open(
            os.path.join(images, "diagram.svg"), "w", encoding="utf-8"
        ) as handle:
            handle.write(
                '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>\n'
            )
        alt_png = os.path.join(images, "tiny.png")
        Image.new("RGB", (16, 16), (200, 30, 60)).save(alt_png, format="PNG")
        alt_size = os.path.getsize(alt_png)
        assert alt_size < 1024, (
            f"Test fixture error: the generated PNG must stay below the probe limit, got {alt_size}."
        )

        if os.path.exists(ALT_REPORT):
            os.remove(ALT_REPORT)
        result = _run_tool("assets/html", tmp_dir, ALT_REPORT)
        print("STDERR:\n" + result.stderr)
        assert result.returncode == 0, (
            f"Tool exited with {result.returncode} on the alternate local tree; stderr:\n{result.stderr}"
        )
        data = _load(ALT_REPORT)
        resolved = _probe(data, "resolution_probes", "local_relative")["resolved"]
        assert os.path.realpath(resolved or "") == os.path.realpath(alt_png), (
            f"local_relative must resolve against the given local root, got {resolved!r}."
        )
        for probe_id in ("data_uri_ok", "local_enabled"):
            entry = _probe(data, "fetch_probes", probe_id)
            assert entry["outcome"] == "loaded", (
                f"{probe_id} must load the alternate image, got {entry['outcome']!r} "
                f"({entry['error_message']!r})."
            )
            assert entry["num_bytes"] == alt_size, (
                f"{probe_id} must report {alt_size} bytes for the alternate image, "
                f"got {entry['num_bytes']!r}."
            )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# 19. Error handling
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "html_dir,local_root",
    [
        ("assets/missing_html", "assets/local"),
        ("assets/html", "assets/missing_local"),
    ],
)
def test_missing_inputs_exit_2_and_write_nothing(happy_run, html_dir, local_root):
    if os.path.exists(MISSING_REPORT):
        os.remove(MISSING_REPORT)
    result = _run_tool(html_dir, local_root, MISSING_REPORT)
    assert result.returncode == 2, (
        f"Missing input directory must exit with code 2, got {result.returncode}; "
        f"stderr:\n{result.stderr}"
    )
    assert not os.path.exists(MISSING_REPORT), (
        "No report must be written when an input directory is missing."
    )


# ---------------------------------------------------------------------------
# 20. Determinism
# ---------------------------------------------------------------------------


def test_reruns_are_byte_identical(happy_run):
    with open(REPORT, "rb") as handle:
        first = handle.read()
    result = _run_tool("assets/html", "assets/local", "output/report.json")
    assert result.returncode == 0, (
        f"Re-running the tool failed with {result.returncode}; stderr:\n{result.stderr}"
    )
    with open(REPORT, "rb") as handle:
        second = handle.read()
    assert first == second, "Two runs with identical arguments must produce identical reports."
