import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
PARSED_MD = os.path.join(PROJECT_DIR, "parsed.md")
EXTRACTED_JSON = os.path.join(PROJECT_DIR, "extracted.json")

PARSE_JOB_LINE_RE = re.compile(r"Parse Job ID:\s*(pjb-[A-Za-z0-9_\-]+)")
EXTRACT_JOB_LINE_RE = re.compile(r"Extract Job ID:\s*([A-Za-z0-9_\-]+)")


@pytest.fixture(scope="session")
def run_id():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, "ZEALT_RUN_ID environment variable is required for verification."
    return value


@pytest.fixture(scope="session")
def llama_client():
    from llama_cloud import LlamaCloud

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable is required for verification."
    return LlamaCloud(api_key=api_key)


@pytest.fixture(scope="session")
def log_contents():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} was not created by the task."
    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        return fh.read()


@pytest.fixture(scope="session")
def parse_job_id(log_contents):
    match = PARSE_JOB_LINE_RE.search(log_contents)
    assert match, (
        f"Expected a line matching 'Parse Job ID: pjb-<id>' in {LOG_FILE}; got:\n{log_contents}"
    )
    return match.group(1)


@pytest.fixture(scope="session")
def extract_job_id(log_contents):
    match = EXTRACT_JOB_LINE_RE.search(log_contents)
    assert match, (
        f"Expected a line matching 'Extract Job ID: <id>' in {LOG_FILE}; got:\n{log_contents}"
    )
    return match.group(1)


def test_parsed_md_exists_and_nonempty():
    assert os.path.isfile(PARSED_MD), f"Parsed markdown file {PARSED_MD} is missing."
    assert os.path.getsize(PARSED_MD) > 0, f"Parsed markdown file {PARSED_MD} is empty."


def test_extracted_json_has_required_keys():
    assert os.path.isfile(EXTRACTED_JSON), (
        f"Extracted JSON file {EXTRACTED_JSON} is missing."
    )
    with open(EXTRACTED_JSON, "r", encoding="utf-8") as fh:
        try:
            data = json.load(fh)
        except json.JSONDecodeError as exc:
            raise AssertionError(
                f"{EXTRACTED_JSON} is not valid JSON: {exc}"
            ) from exc

    # The Extract API may wrap the result, so unwrap a single top-level data/result key.
    candidates = [data]
    if isinstance(data, dict):
        for key in ("data", "result", "extract_result"):
            if key in data and isinstance(data[key], dict):
                candidates.append(data[key])

    required = {"vendor", "invoice_number", "total_amount", "line_items"}
    for candidate in candidates:
        if isinstance(candidate, dict) and required.issubset(candidate.keys()):
            return
    raise AssertionError(
        f"Extracted JSON at {EXTRACTED_JSON} must contain keys {sorted(required)}; got top-level keys "
        f"{list(data.keys()) if isinstance(data, dict) else type(data).__name__}."
    )


def test_log_contains_parse_and_extract_ids(parse_job_id, extract_job_id):
    assert parse_job_id.startswith("pjb-"), (
        f"Parse Job ID in {LOG_FILE} must start with 'pjb-'; got {parse_job_id!r}."
    )
    assert extract_job_id, f"Extract Job ID in {LOG_FILE} must be non-empty."


def test_parse_job_completed_in_llamacloud(llama_client, parse_job_id):
    response = llama_client.parsing.get(parse_job_id)
    # In llama-cloud v2.x, ParsingGetResponse nests job metadata (including status)
    # under the .job attribute. Older SDKs exposed status at the top level.
    status = getattr(response, "status", None)
    if status is None:
        nested_job = getattr(response, "job", None)
        status = getattr(nested_job, "status", None)
    assert status == "COMPLETED", (
        f"Parse job {parse_job_id} in LlamaCloud has status {status!r}, expected 'COMPLETED'."
    )


def test_extract_job_completed_and_chains_parse_job(
    llama_client, parse_job_id, extract_job_id
):
    job = llama_client.extract.get(extract_job_id)
    status = getattr(job, "status", None)
    assert status == "COMPLETED", (
        f"Extract job {extract_job_id} in LlamaCloud has status {status!r}, expected 'COMPLETED'."
    )

    # The chain is proved by file_input being the parse-job id, not a fresh dfl-... file.
    file_input = getattr(job, "file_input", None)
    assert file_input == parse_job_id, (
        f"Extract job's file_input was {file_input!r}; expected the parse-job id {parse_job_id!r} "
        f"(proving the parse-then-extract chain pattern was used)."
    )


def test_uploaded_file_has_run_id_suffix(llama_client, run_id):
    matching = []
    files_iter = llama_client.files.list()
    # Limit how many we scan to avoid sweeping an entire account.
    for idx, file_obj in enumerate(files_iter):
        if idx >= 500:
            break
        external_id = getattr(file_obj, "external_file_id", None) or ""
        if external_id.endswith(run_id):
            matching.append(external_id)
            break
    assert matching, (
        f"Expected at least one uploaded file whose external_file_id ends with the run-id "
        f"{run_id!r}; none found in the most recent 500 files."
    )
