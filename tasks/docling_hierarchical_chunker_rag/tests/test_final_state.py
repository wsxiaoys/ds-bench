import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
OUTPUT_PATH = os.path.join(PROJECT_DIR, "output", "chunks.jsonl")
MAIN_PATH = os.path.join(PROJECT_DIR, "main.py")

SEP = " > "
MARKER_TOKEN = "ZQPLUMBAGO-7731"
TABLE_TOKEN = "TBLQUOKKA-4402"
EXPECTED_MARKER_HEADING_PATH = [
    "Quarterly Operations Report",
    "Financial Overview",
    "Regional Performance",
    "Northwest District Analysis",
]
DOC_TITLE = "Quarterly Operations Report"


@pytest.fixture(scope="session")
def chunks():
    """Run the agent's pipeline fresh and load the produced JSONL records."""
    assert os.path.isfile(MAIN_PATH), f"Expected entrypoint {MAIN_PATH} does not exist."

    # Ensure a clean, deterministic run: remove any stale output first.
    if os.path.isfile(OUTPUT_PATH):
        os.remove(OUTPUT_PATH)

    result = subprocess.run(
        ["python3", "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
    )
    assert result.returncode == 0, (
        "Running 'python3 main.py' failed with a non-zero exit code.\n"
        f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
    )

    assert os.path.isfile(OUTPUT_PATH), (
        f"Expected output file {OUTPUT_PATH} was not created by 'python3 main.py'.\n"
        f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
    )

    records = []
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as exc:
                pytest.fail(f"Line {lineno} of {OUTPUT_PATH} is not valid JSON: {exc}")
            records.append(obj)

    assert len(records) > 0, f"{OUTPUT_PATH} contains no JSON records."
    return records


def test_output_file_created(chunks):
    # The chunks fixture already asserts creation + parseability; this makes the
    # dependency an explicit, named test case.
    assert len(chunks) > 0, "No chunks were produced."


def test_schema_and_types(chunks):
    expected_keys = {"id", "heading_path", "text", "page_no"}
    for i, obj in enumerate(chunks):
        assert isinstance(obj, dict), f"Record {i} is not a JSON object."
        assert set(obj.keys()) == expected_keys, (
            f"Record {i} has key set {sorted(obj.keys())}, "
            f"expected exactly {sorted(expected_keys)}."
        )
        # id must be an int (JSON has no separate int type, but bool is a subclass
        # of int and must be rejected).
        assert isinstance(obj["id"], int) and not isinstance(obj["id"], bool), (
            f"Record {i}: 'id' must be an int, got {type(obj['id']).__name__}."
        )
        assert isinstance(obj["text"], str), (
            f"Record {i}: 'text' must be a str, got {type(obj['text']).__name__}."
        )
        assert isinstance(obj["heading_path"], list) and len(obj["heading_path"]) > 0, (
            f"Record {i}: 'heading_path' must be a non-empty list."
        )
        for j, h in enumerate(obj["heading_path"]):
            assert isinstance(h, str), (
                f"Record {i}: heading_path[{j}] must be a str, got {type(h).__name__}."
            )
        assert isinstance(obj["page_no"], int) and not isinstance(obj["page_no"], bool), (
            f"Record {i}: 'page_no' must be an int, got {type(obj['page_no']).__name__}."
        )
        assert obj["page_no"] >= 1, (
            f"Record {i}: 'page_no' must be 1-based (>= 1), got {obj['page_no']}."
        )


def test_ids_sequential_document_order(chunks):
    ids = [obj["id"] for obj in chunks]
    expected = list(range(len(chunks)))
    assert ids == expected, (
        "The 'id' values must be 0-based, contiguous and strictly increasing by 1 "
        f"in document order. Expected {expected[:5]}... got {ids[:5]}..."
    )


def test_text_begins_with_heading_path(chunks):
    for i, obj in enumerate(chunks):
        prefix = SEP.join(obj["heading_path"])
        assert obj["text"].startswith(prefix), (
            f"Record {i}: 'text' must begin with the ' > '-joined heading path.\n"
            f"Expected prefix: {prefix!r}\nActual text start: {obj['text'][:120]!r}"
        )


def test_marker_subsection_heading_path(chunks):
    matches = [obj for obj in chunks if MARKER_TOKEN in obj["text"]]
    assert len(matches) == 1, (
        f"Expected exactly one chunk containing the marker token {MARKER_TOKEN!r}, "
        f"found {len(matches)}."
    )
    marker = matches[0]
    normalized = [h.strip() for h in marker["heading_path"]]
    assert normalized == EXPECTED_MARKER_HEADING_PATH, (
        "The marked deep subsection's heading_path does not match the expected "
        f"hierarchy.\nExpected: {EXPECTED_MARKER_HEADING_PATH}\nGot: {normalized}"
    )
    expected_prefix = SEP.join(EXPECTED_MARKER_HEADING_PATH)
    assert marker["text"].startswith(expected_prefix), (
        "The marker chunk's text must begin with its full heading path.\n"
        f"Expected prefix: {expected_prefix!r}\nActual: {marker['text'][:160]!r}"
    )


def test_marker_page_number(chunks):
    matches = [obj for obj in chunks if MARKER_TOKEN in obj["text"]]
    assert len(matches) == 1, (
        f"Expected exactly one chunk containing the marker token {MARKER_TOKEN!r}, "
        f"found {len(matches)}."
    )
    assert matches[0]["page_no"] == 1, (
        f"The marker chunk must originate from page 1, got {matches[0]['page_no']}."
    )


def test_table_chunked_within_section_context(chunks):
    matches = [obj for obj in chunks if TABLE_TOKEN in obj["text"]]
    assert len(matches) >= 1, (
        f"Expected at least one chunk containing the table cell token {TABLE_TOKEN!r}; "
        "the table does not appear to have been chunked."
    )
    for obj in matches:
        assert len(obj["heading_path"]) > 0, (
            "A table-derived chunk must retain a non-empty heading_path."
        )
        assert obj["heading_path"][0].strip() == DOC_TITLE, (
            "A table-derived chunk's heading path must be rooted at the document "
            f"title {DOC_TITLE!r}, got {obj['heading_path']}."
        )
