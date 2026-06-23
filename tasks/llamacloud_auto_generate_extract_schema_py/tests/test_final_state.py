import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/extract_task"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "schema.json")
RESULT_PATH = os.path.join(PROJECT_DIR, "result.json")
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")

INVOICE_NUMBER_KEYWORDS = ("invoice", "number", "id")
VENDOR_KEYWORDS = ("vendor", "supplier", "seller", "merchant")
TOTAL_KEYWORDS = ("total", "amount", "grand_total", "summary", "subtotal")

JOB_ID_RE = re.compile(r"^Job ID:\s*(?P<job_id>(ej|exj|ext)-[A-Za-z0-9_\-]+)\s*$")
SCHEMA_FIELDS_RE = re.compile(r"^Schema fields:\s*(?P<fields>.+?)\s*$")
STATUS_RE = re.compile(r"^Status:\s*COMPLETED\s*$")


def _load_json(path):
    assert os.path.isfile(path), f"Expected file {path} to exist."
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as exc:
            pytest.fail(f"File {path} is not valid JSON: {exc}")


def _read_log_lines():
    assert os.path.isfile(LOG_PATH), f"Expected log file {LOG_PATH} to exist."
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f.readlines()]


def _matches_any(key, keywords):
    lowered = key.lower()
    return any(kw in lowered for kw in keywords)


def test_schema_file_is_valid_json_schema():
    schema = _load_json(SCHEMA_PATH)
    assert isinstance(schema, dict), "schema.json must be a JSON object."
    assert schema.get("type") == "object", (
        f"schema.json must declare 'type': 'object'; got {schema.get('type')!r}."
    )
    properties = schema.get("properties")
    assert isinstance(properties, dict) and len(properties) >= 3, (
        f"schema.json must contain at least 3 entries under 'properties'; got "
        f"{list(properties.keys()) if isinstance(properties, dict) else properties}."
    )


def test_schema_covers_invoice_concepts():
    schema = _load_json(SCHEMA_PATH)
    keys = list(schema.get("properties", {}).keys())
    assert any(_matches_any(k, INVOICE_NUMBER_KEYWORDS) for k in keys), (
        "schema.json must include a property referencing the invoice number / id. "
        f"Got keys: {keys}."
    )
    assert any(_matches_any(k, VENDOR_KEYWORDS) for k in keys), (
        "schema.json must include a property referencing the vendor / supplier. "
        f"Got keys: {keys}."
    )
    assert any(_matches_any(k, TOTAL_KEYWORDS) for k in keys), (
        "schema.json must include a property referencing the invoice total / amount. "
        f"Got keys: {keys}."
    )


def test_result_file_is_non_empty_json_object():
    result = _load_json(RESULT_PATH)
    assert isinstance(result, dict), "result.json must be a JSON object."
    assert len(result) >= 1, "result.json must contain at least one extracted field."


def test_log_contains_schema_fields_matching_schema():
    schema = _load_json(SCHEMA_PATH)
    expected_keys = set(schema.get("properties", {}).keys())
    lines = _read_log_lines()
    matches = [SCHEMA_FIELDS_RE.match(line) for line in lines]
    matches = [m for m in matches if m]
    assert matches, (
        f"output.log must contain a line of the form 'Schema fields: <...>'. Got lines: {lines}"
    )
    line_keys = {part.strip() for part in matches[0].group("fields").split(",") if part.strip()}
    assert line_keys == expected_keys, (
        f"'Schema fields' line {line_keys!r} must match schema.json properties {expected_keys!r}."
    )


def test_log_contains_job_id_and_status():
    lines = _read_log_lines()
    job_id_matches = [JOB_ID_RE.match(line) for line in lines]
    job_id_matches = [m for m in job_id_matches if m]
    assert job_id_matches, (
        "output.log must contain a line 'Job ID: <ej-... or exj-...>'. Got lines: "
        f"{lines}"
    )
    assert any(STATUS_RE.match(line) for line in lines), (
        f"output.log must contain a line exactly matching 'Status: COMPLETED'. Got lines: {lines}"
    )


def test_extract_job_is_completed_via_sdk():
    from llama_cloud import LlamaCloud

    lines = _read_log_lines()
    job_id = None
    for line in lines:
        m = JOB_ID_RE.match(line)
        if m:
            job_id = m.group("job_id")
            break
    assert job_id, "Could not extract a Job ID from output.log."

    client = LlamaCloud()
    job = client.extract.get(job_id)
    status = getattr(job, "status", None)
    assert status == "COMPLETED", (
        f"LlamaCloud reports extract job {job_id} status={status!r}; expected 'COMPLETED'."
    )
    extract_result = getattr(job, "extract_result", None)
    assert extract_result, (
        f"LlamaCloud extract job {job_id} returned an empty extract_result."
    )


def test_uploaded_file_uses_run_id_external_id():
    from llama_cloud import LlamaCloud

    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID must be set in the verifier environment."
    expected_suffix = f"-{run_id}.pdf"

    client = LlamaCloud()
    found = False
    for file_obj in client.files.list():
        external_file_id = getattr(file_obj, "external_file_id", None) or ""
        if external_file_id.endswith(expected_suffix):
            found = True
            break
    assert found, (
        f"No uploaded file has an external_file_id ending with {expected_suffix!r}; "
        "the agent did not include ZEALT_RUN_ID in the uploaded file's external_file_id."
    )
