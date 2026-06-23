import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/llamacloud-task"
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")
RESULT_PATH = os.path.join(PROJECT_DIR, "result.json")


def _read_log():
    assert os.path.isfile(LOG_PATH), f"Expected log file at {LOG_PATH}"
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _read_result():
    assert os.path.isfile(RESULT_PATH), f"Expected result JSON at {RESULT_PATH}"
    with open(RESULT_PATH, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as exc:
            pytest.fail(f"{RESULT_PATH} is not valid JSON: {exc}")


def _extract_job_id():
    text = _read_log()
    match = re.search(r"^Extract job:\s*(\S+)\s*$", text, re.MULTILINE)
    assert match, (
        f"Could not find a line matching `^Extract job: <id>$` in {LOG_PATH}.\n"
        f"Log contents were:\n{text}"
    )
    return match.group(1)


def test_log_has_extract_job_line():
    job_id = _extract_job_id()
    assert job_id, "Captured job id should be a non-empty string."


def test_log_has_completed_status_line():
    text = _read_log()
    assert re.search(r"^Status:\s*COMPLETED\s*$", text, re.MULTILINE), (
        f"Expected a line `Status: COMPLETED` in {LOG_PATH}. Got:\n{text}"
    )


def test_result_json_data_block():
    result = _read_result()
    assert "data" in result, "Top-level `data` key missing in result.json."
    data = result["data"]
    assert isinstance(data, dict), "`data` must be a JSON object."

    # company_name
    company = data.get("company_name")
    assert isinstance(company, str) and company.strip(), (
        f"data.company_name must be a non-empty string, got: {company!r}"
    )
    assert "acme robotics" in company.strip().lower(), (
        f"data.company_name should contain 'Acme Robotics, Inc.' "
        f"(case-insensitive), got: {company!r}"
    )

    # invoice_number
    inv_no = data.get("invoice_number")
    assert isinstance(inv_no, str), (
        f"data.invoice_number must be a string, got: {inv_no!r}"
    )
    assert inv_no.strip() == "INV-2024-9876", (
        f"data.invoice_number must equal 'INV-2024-9876', got: {inv_no!r}"
    )

    # total_amount
    total = data.get("total_amount")
    assert isinstance(total, (int, float)), (
        f"data.total_amount must be a number, got: {total!r}"
    )
    assert abs(float(total) - 1499.99) <= 0.01, (
        f"data.total_amount must be ~1499.99, got: {total!r}"
    )


def test_result_json_field_metadata_citations():
    result = _read_result()
    em = result.get("extract_metadata")
    assert isinstance(em, dict) and em, (
        "Top-level `extract_metadata` object missing or empty in result.json."
    )
    fm = em.get("field_metadata")
    assert isinstance(fm, dict) and fm, (
        "`extract_metadata.field_metadata` object missing or empty."
    )

    for field in ("company_name", "invoice_number", "total_amount"):
        node = fm.get(field)
        assert isinstance(node, dict), (
            f"`field_metadata.{field}` must be an object, got: {node!r}"
        )
        citations = node.get("citation")
        assert isinstance(citations, list) and citations, (
            f"`field_metadata.{field}.citation` must be a non-empty list."
        )
        first = citations[0]
        assert isinstance(first, dict), (
            f"Each citation entry must be an object; got: {first!r}"
        )
        assert isinstance(first.get("page"), int), (
            f"`field_metadata.{field}.citation[0].page` must be an integer."
        )
        matching = first.get("matching_text")
        assert isinstance(matching, str) and matching.strip(), (
            f"`field_metadata.{field}.citation[0].matching_text` must be a "
            "non-empty string."
        )


def test_extract_job_status_via_sdk():
    """Hit the LlamaCloud API to confirm the job actually exists & completed."""
    job_id = _extract_job_id()
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY must be set in the verifier environment."

    from llama_cloud import LlamaCloud

    client = LlamaCloud(api_key=api_key)
    job = client.extract.get(job_id)
    status = getattr(job, "status", None)
    assert str(status) in ("COMPLETED", "ExtractJobStatus.COMPLETED"), (
        f"Expected LlamaCloud extract job {job_id} status to be COMPLETED, "
        f"got: {status!r}"
    )


def test_uploaded_file_uses_run_id_external_id():
    """Confirm the uploaded source file's external_file_id includes run-id."""
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID must be set in the verifier environment."
    expected_external_id = f"invoice-{run_id}.txt"

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY must be set in the verifier environment."

    from llama_cloud import LlamaCloud

    client = LlamaCloud(api_key=api_key)
    job_id = _extract_job_id()
    job = client.extract.get(job_id)

    # The extract job carries the source file id; resolve it back to the file
    # record and verify external_file_id.
    file_id = (
        getattr(job, "file_id", None)
        or getattr(getattr(job, "data", None), "file_id", None)
        or getattr(getattr(job, "extract_result", None), "file_id", None)
    )
    if not file_id:
        # Fall back to listing files by external_file_id.
        matched = []
        try:
            for f in client.files.list(external_file_id=expected_external_id):
                matched.append(f)
        except TypeError:
            # If `external_file_id` is not a list-filter kwarg in this SDK
            # version, paginate and filter client-side.
            for f in client.files.list():
                if getattr(f, "external_file_id", None) == expected_external_id:
                    matched.append(f)
                    break
        assert matched, (
            f"Could not find an uploaded file with external_file_id="
            f"{expected_external_id!r} in the LlamaCloud account."
        )
        return

    file_obj = client.files.get(file_id)
    ext_id = getattr(file_obj, "external_file_id", None)
    assert ext_id == expected_external_id, (
        f"Uploaded file external_file_id must equal {expected_external_id!r}, "
        f"got: {ext_id!r}"
    )
