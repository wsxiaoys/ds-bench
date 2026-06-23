import json
import os
import re

import httpx
import pytest

PROJECT_DIR = "/home/user/myproject"
OUTPUT_JSON = os.path.join(PROJECT_DIR, "output.json")
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")

REQUIRED_FIELDS = {
    "product_code": str,
    "product_name": str,
    "category": str,
    "stock": int,
}
# price_usd may come back as int or float
NUMERIC_FIELDS = {"price_usd"}

MIN_ROWS = 10
REQUIRED_CODES = {"P001", "P012"}


@pytest.fixture(scope="module")
def run_id() -> str:
    rid = os.environ.get("ZEALT_RUN_ID")
    assert rid, "ZEALT_RUN_ID environment variable is required for verification."
    return rid


@pytest.fixture(scope="module")
def api_key() -> str:
    key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert key, "LLAMA_CLOUD_API_KEY environment variable is required for verification."
    return key


@pytest.fixture(scope="module")
def parsed_rows():
    assert os.path.isfile(OUTPUT_JSON), (
        f"Expected output JSON at {OUTPUT_JSON}; the agent must write the extraction result there."
    )
    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        raw = f.read()
    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as exc:  # pragma: no cover - assertion fires below
        raise AssertionError(f"{OUTPUT_JSON} is not valid UTF-8 JSON: {exc}") from exc
    assert isinstance(rows, list), (
        f"Top-level JSON in {OUTPUT_JSON} must be a list/array (got {type(rows).__name__})."
    )
    return rows


def test_output_json_is_a_list_with_enough_rows(parsed_rows):
    assert len(parsed_rows) >= MIN_ROWS, (
        f"Expected at least {MIN_ROWS} extracted rows in {OUTPUT_JSON}, got {len(parsed_rows)}."
    )


def test_every_row_has_required_fields_and_types(parsed_rows):
    for idx, row in enumerate(parsed_rows):
        assert isinstance(row, dict), (
            f"Row {idx} in output.json must be a JSON object, got {type(row).__name__}."
        )
        for field, expected_type in REQUIRED_FIELDS.items():
            assert field in row, f"Row {idx} is missing required field '{field}': {row!r}"
            if expected_type is int:
                # tolerate JSON numbers that are whole-number floats (e.g., 5.0)
                value = row[field]
                assert isinstance(value, int) and not isinstance(value, bool), (
                    f"Row {idx} field '{field}' must be an integer, got {type(value).__name__}: {value!r}"
                )
            else:
                assert isinstance(row[field], expected_type), (
                    f"Row {idx} field '{field}' must be a {expected_type.__name__}, "
                    f"got {type(row[field]).__name__}: {row[field]!r}"
                )
        for field in NUMERIC_FIELDS:
            assert field in row, f"Row {idx} is missing required field '{field}': {row!r}"
            value = row[field]
            assert isinstance(value, (int, float)) and not isinstance(value, bool), (
                f"Row {idx} field '{field}' must be a number, got {type(value).__name__}: {value!r}"
            )


def test_required_product_codes_present(parsed_rows):
    codes = {str(row.get("product_code", "")).strip() for row in parsed_rows}
    missing = REQUIRED_CODES - codes
    assert not missing, (
        f"Expected product codes {sorted(REQUIRED_CODES)} to appear in extracted rows; "
        f"missing: {sorted(missing)}. Got codes: {sorted(codes)}"
    )


def test_log_file_reports_matching_row_count(parsed_rows):
    assert os.path.isfile(OUTPUT_LOG), f"Expected log file at {OUTPUT_LOG}."
    with open(OUTPUT_LOG, "r", encoding="utf-8") as f:
        log_text = f.read()
    match = re.search(r"^Extracted rows: (\d+)$", log_text, flags=re.MULTILINE)
    assert match, (
        f"Expected a line matching 'Extracted rows: <N>' in {OUTPUT_LOG}; got contents:\n{log_text}"
    )
    reported = int(match.group(1))
    assert reported == len(parsed_rows), (
        f"Log says 'Extracted rows: {reported}' but output.json has {len(parsed_rows)} rows."
    )


def test_package_json_does_not_use_deprecated_v1_packages():
    assert os.path.isfile(PACKAGE_JSON), f"{PACKAGE_JSON} must exist."
    with open(PACKAGE_JSON, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}) or {})
    deps.update(pkg.get("devDependencies", {}) or {})
    forbidden = {"llama-cloud-services", "llamaindex", "llama-parse", "llama_parse"}
    used_forbidden = sorted(d for d in forbidden if d in deps)
    assert not used_forbidden, (
        f"Task requires the v2 TS SDK '@llamaindex/llama-cloud' only, but package.json lists "
        f"deprecated v1 dependencies: {used_forbidden}."
    )
    assert "@llamaindex/llama-cloud" in deps, (
        "Expected '@llamaindex/llama-cloud' in package.json dependencies."
    )


def test_file_was_uploaded_with_run_id_scoped_external_id(api_key, run_id):
    """Cross-check against the real LlamaCloud API that the agent uploaded the PDF
    with an external_file_id of `products-${run_id}.pdf`."""
    expected_external_id = f"products-{run_id}.pdf"
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=60.0) as client:
        # The v1 Files list endpoint supports filtering by external_file_id.
        resp = client.get(
            "https://api.cloud.llamaindex.ai/api/v1/files",
            headers=headers,
            params={"external_file_id": expected_external_id},
        )
        assert resp.status_code == 200, (
            f"LlamaCloud Files API returned HTTP {resp.status_code}: {resp.text[:500]}"
        )
        payload = resp.json()
        # The endpoint may return either a list directly or a paginated object.
        if isinstance(payload, dict) and "data" in payload:
            items = payload.get("data") or []
        else:
            items = payload if isinstance(payload, list) else []
        matches = [
            f for f in items
            if isinstance(f, dict) and f.get("external_file_id") == expected_external_id
        ]
        assert matches, (
            f"No file found on LlamaCloud with external_file_id='{expected_external_id}'. "
            f"The agent must upload the PDF using this run-id-scoped external_file_id."
        )
        # Confirm at least one upload was for the extract purpose.
        purposes = {f.get("purpose") for f in matches}
        assert "extract" in purposes, (
            f"Expected at least one upload of '{expected_external_id}' with purpose='extract', "
            f"got purposes: {purposes}."
        )
