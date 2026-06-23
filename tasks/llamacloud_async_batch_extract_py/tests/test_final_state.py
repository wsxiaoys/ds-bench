import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
RESULTS_JSON = os.path.join(PROJECT_DIR, "results.json")

EXPECTED_FILENAMES = {"invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf"}
EXPECTED_FIELDS = {"vendor_name", "invoice_number", "total_amount", "line_items"}

# Pattern: Extract Job: <filename> <job_id> <status>
LOG_LINE_RE = re.compile(
    r"Extract Job:\s+(invoice_[abc]\.pdf)\s+(\S+)\s+(\S+)"
)


@pytest.fixture(scope="session")
def run_id():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, "ZEALT_RUN_ID environment variable is required for verification."
    return value


@pytest.fixture(scope="session")
def llama_client():
    from llama_cloud import LlamaCloud

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, (
        "LLAMA_CLOUD_API_KEY environment variable is required for verification."
    )
    return LlamaCloud(api_key=api_key)


@pytest.fixture(scope="session")
def log_triples():
    """Parse output.log and return list of (filename, job_id, status) triples."""
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} was not created by the task."
    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        content = fh.read()
    triples = LOG_LINE_RE.findall(content)
    return triples, content


def test_results_json_structure():
    assert os.path.isfile(RESULTS_JSON), (
        f"Results JSON file {RESULTS_JSON} is missing."
    )
    with open(RESULTS_JSON, "r", encoding="utf-8") as fh:
        try:
            data = json.load(fh)
        except json.JSONDecodeError as exc:
            raise AssertionError(
                f"{RESULTS_JSON} is not valid JSON: {exc}"
            ) from exc

    assert isinstance(data, dict), (
        f"{RESULTS_JSON} must be a JSON object at the top level; "
        f"got {type(data).__name__}."
    )
    missing = EXPECTED_FILENAMES - set(data.keys())
    assert not missing, (
        f"{RESULTS_JSON} must contain top-level keys for each invoice "
        f"({sorted(EXPECTED_FILENAMES)}); missing: {sorted(missing)}."
    )

    for filename in EXPECTED_FILENAMES:
        entry = data[filename]
        # The Extract API may wrap the result, so unwrap a single top-level data/result key.
        candidates = [entry]
        if isinstance(entry, dict):
            for key in ("data", "result", "extract_result"):
                if key in entry and isinstance(entry[key], dict):
                    candidates.append(entry[key])

        matched = False
        for candidate in candidates:
            if (
                isinstance(candidate, dict)
                and EXPECTED_FIELDS.issubset(candidate.keys())
            ):
                matched = True
                break

        assert matched, (
            f"Entry for {filename!r} in {RESULTS_JSON} must contain keys "
            f"{sorted(EXPECTED_FIELDS)}; got "
            f"{list(entry.keys()) if isinstance(entry, dict) else type(entry).__name__}."
        )


def test_log_has_three_extract_lines(log_triples):
    triples, content = log_triples
    assert len(triples) >= 3, (
        f"Expected at least 3 lines matching "
        f"'Extract Job: <filename> <job_id> <status>' in {LOG_FILE}; "
        f"got {len(triples)} matches. Full log content:\n{content}"
    )
    # Filter to the three expected filenames; each filename must appear exactly once.
    filenames = [t[0] for t in triples if t[0] in EXPECTED_FILENAMES]
    assert set(filenames) == EXPECTED_FILENAMES, (
        f"Expected one log line per invoice in {EXPECTED_FILENAMES}; "
        f"got filenames {filenames}."
    )
    # Each expected filename should appear exactly once.
    for name in EXPECTED_FILENAMES:
        count = filenames.count(name)
        assert count == 1, (
            f"Expected exactly one 'Extract Job: {name} ...' line in {LOG_FILE}; "
            f"got {count}."
        )


def test_log_statuses_all_completed(log_triples):
    triples, _ = log_triples
    relevant = [t for t in triples if t[0] in EXPECTED_FILENAMES]
    for filename, job_id, status in relevant:
        assert status == "COMPLETED", (
            f"Expected status COMPLETED for {filename} in {LOG_FILE}; "
            f"got {status!r} (job id {job_id})."
        )


def test_log_job_ids_distinct(log_triples):
    triples, _ = log_triples
    relevant = [t for t in triples if t[0] in EXPECTED_FILENAMES]
    job_ids = [t[1] for t in relevant]
    assert len(set(job_ids)) == len(job_ids), (
        f"Expected all three Extract job IDs in {LOG_FILE} to be distinct; "
        f"got {job_ids}."
    )


def test_extract_jobs_completed_in_llamacloud(llama_client, log_triples):
    triples, _ = log_triples
    relevant = [t for t in triples if t[0] in EXPECTED_FILENAMES]
    assert relevant, "No valid 'Extract Job' lines parsed from log."

    for filename, job_id, _status in relevant:
        job = llama_client.extract.get(job_id)
        cloud_status = getattr(job, "status", None)
        assert cloud_status == "COMPLETED", (
            f"Extract job {job_id} for {filename} has LlamaCloud status "
            f"{cloud_status!r}, expected 'COMPLETED'."
        )


def test_uploaded_files_have_run_id_suffix(llama_client, run_id):
    matching = []
    files_iter = llama_client.files.list()
    # Scan a bounded number of recent files to avoid sweeping an entire account.
    for idx, file_obj in enumerate(files_iter):
        if idx >= 1000:
            break
        external_id = getattr(file_obj, "external_file_id", None) or ""
        if external_id.endswith(run_id):
            matching.append(external_id)
        if len(matching) >= 3:
            break
    assert len(matching) >= 3, (
        f"Expected at least three uploaded files whose external_file_id ends "
        f"with the run-id {run_id!r}; found {len(matching)} in the most recent "
        f"1000 files. Matches: {matching}"
    )
