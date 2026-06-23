import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/parse-task"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
PARSED_MD = os.path.join(OUTPUT_DIR, "parsed.md")
RESULT_LOG = os.path.join(OUTPUT_DIR, "result.log")
PARSE_SCRIPT = os.path.join(PROJECT_DIR, "parse.ts")
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")

FILE_ID_RE = re.compile(r"^File ID:\s*([0-9a-fA-F][0-9a-fA-F\-]{7,})\s*$", re.MULTILINE)
JOB_ID_RE = re.compile(r"^Job ID:\s*([0-9a-zA-Z][0-9a-zA-Z\-_]{7,})\s*$", re.MULTILINE)
STATUS_RE = re.compile(r"^Job Status:\s*COMPLETED\s*$", re.MULTILINE)
PAGE_COUNT_RE = re.compile(r"^Page Count:\s*([1-9][0-9]*)\s*$", re.MULTILINE)


@pytest.fixture(scope="module")
def log_content():
    assert os.path.isfile(RESULT_LOG), f"Result log {RESULT_LOG} does not exist."
    with open(RESULT_LOG, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


@pytest.fixture(scope="module")
def parsed_md_content():
    assert os.path.isfile(PARSED_MD), f"Parsed markdown file {PARSED_MD} does not exist."
    with open(PARSED_MD, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


@pytest.fixture(scope="module")
def file_id(log_content):
    m = FILE_ID_RE.search(log_content)
    assert m, (
        "result.log does not contain a line matching '^File ID: <uuid-like-id>$'. "
        f"Log content:\n{log_content!r}"
    )
    return m.group(1)


@pytest.fixture(scope="module")
def job_id(log_content):
    m = JOB_ID_RE.search(log_content)
    assert m, (
        "result.log does not contain a line matching '^Job ID: <uuid-like-id>$'. "
        f"Log content:\n{log_content!r}"
    )
    return m.group(1)


@pytest.fixture(scope="module")
def page_count(log_content):
    m = PAGE_COUNT_RE.search(log_content)
    assert m, (
        "result.log does not contain a line matching '^Page Count: <positive integer>$'. "
        f"Log content:\n{log_content!r}"
    )
    return int(m.group(1))


def test_parse_script_exists():
    assert os.path.isfile(PARSE_SCRIPT), f"TypeScript source {PARSE_SCRIPT} does not exist."


def test_package_json_lists_llama_cloud():
    assert os.path.isfile(PACKAGE_JSON), f"{PACKAGE_JSON} does not exist."
    with open(PACKAGE_JSON, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    deps = {}
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        deps.update(pkg.get(section, {}) or {})
    assert "@llamaindex/llama-cloud" in deps, (
        "package.json does not list '@llamaindex/llama-cloud' as a dependency. "
        f"Found: {sorted(deps.keys())!r}"
    )


def test_parsed_md_non_empty(parsed_md_content):
    assert os.path.getsize(PARSED_MD) > 0, f"{PARSED_MD} is empty (0 bytes)."
    stripped = parsed_md_content.strip()
    assert stripped, f"{PARSED_MD} contains only whitespace."


def test_log_has_completed_status(log_content):
    assert STATUS_RE.search(log_content), (
        "result.log does not contain a line exactly matching 'Job Status: COMPLETED'. "
        f"Log content:\n{log_content!r}"
    )


def test_log_has_file_id(file_id):
    # Triggered by the fixture; existence is the assertion.
    assert file_id, "File ID was not captured from result.log."


def test_log_has_job_id(job_id):
    assert job_id, "Job ID was not captured from result.log."


def test_log_has_page_count(page_count):
    assert page_count >= 1, f"Page Count must be >= 1, got {page_count}."


def test_page_count_matches_separator_layout(parsed_md_content, page_count):
    # Pages in parsed.md are joined by a line containing exactly '---'.
    # N pages -> N-1 such separator lines.
    sections = re.split(r"(?m)^---$", parsed_md_content)
    assert len(sections) == page_count, (
        f"Expected {page_count} markdown section(s) separated by '---' lines, "
        f"but found {len(sections)} section(s) in {PARSED_MD}."
    )


def test_job_verifiable_via_llamacloud_api(job_id):
    """Use the LlamaCloud REST API to confirm that the recorded job_id exists,
    completed successfully, and used the cost_effective tier."""
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY is not set in the verifier environment."

    import requests

    url = f"https://api.cloud.llamaindex.ai/api/v2/parse/{job_id}"
    resp = requests.get(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        timeout=60,
    )
    assert resp.status_code == 200, (
        f"GET {url} returned HTTP {resp.status_code}: {resp.text[:500]!r}"
    )

    payload = resp.json()
    assert isinstance(payload, dict), f"Expected JSON object from {url}, got: {payload!r}"

    # Status field — the v2 API uses 'status' on the job object.
    job_obj = payload.get("job", payload)
    status = (
        job_obj.get("status")
        or payload.get("status")
        or job_obj.get("job_status")
    )
    assert isinstance(status, str) and status.upper() in {"COMPLETED", "SUCCESS"}, (
        f"LlamaCloud parse job {job_id} has unexpected status: {status!r}. "
        f"Full payload keys: {list(payload.keys())!r}"
    )

    tier = (
        job_obj.get("tier")
        or payload.get("tier")
        or (payload.get("request") or {}).get("tier")
    )
    assert isinstance(tier, str) and tier == "cost_effective", (
        f"LlamaCloud parse job {job_id} was run with tier={tier!r}, "
        "expected 'cost_effective'."
    )


def test_node_can_load_llama_cloud_sdk_in_project():
    """Sanity-check that the project's node_modules has @llamaindex/llama-cloud
    so that the parse.ts script could actually run."""
    result = subprocess.run(
        [
            "node",
            "-e",
            "require.resolve('@llamaindex/llama-cloud'); console.log('ok');",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0 and "ok" in result.stdout, (
        "@llamaindex/llama-cloud is not resolvable from the project's node_modules. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
