import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
SCRIPT_PATH = os.path.join(PROJECT_DIR, "extract_resume.py")
OUTPUT_JSON = os.path.join(PROJECT_DIR, "output.json")
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")

EXPECTED_NAME_SUBSTR = "alex johnson"
EXPECTED_EMAIL = "alex.johnson@example.com"
EXPECTED_SKILL_KEYWORDS = ["python", "machine learning", "sql", "docker", "kubernetes"]


def _run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id.startswith("zr-") and len(run_id) > 3, (
        "ZEALT_RUN_ID environment variable must be set to a `zr-<suffix>` value during verification."
    )
    return run_id


def _llama_client():
    from llama_cloud import LlamaCloud

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY must be available to the verifier."
    return LlamaCloud(api_key=api_key)


@pytest.fixture(scope="module")
def parsed_output():
    assert os.path.isfile(OUTPUT_JSON), f"Expected output JSON at {OUTPUT_JSON} to exist."
    with open(OUTPUT_JSON, "r", encoding="utf-8") as fp:
        data = json.load(fp)
    assert isinstance(data, dict), f"{OUTPUT_JSON} must contain a JSON object, got {type(data).__name__}."
    return data


@pytest.fixture(scope="module")
def job_id() -> str:
    assert os.path.isfile(OUTPUT_LOG), f"Expected log file at {OUTPUT_LOG} to exist."
    with open(OUTPUT_LOG, "r", encoding="utf-8") as fp:
        lines = [ln for ln in (raw.strip() for raw in fp) if ln]
    assert len(lines) == 1, (
        f"{OUTPUT_LOG} must contain exactly one non-empty line, found {len(lines)}: {lines!r}"
    )
    match = re.fullmatch(r"Job ID: (?P<job_id>[A-Za-z0-9_-]+)", lines[0])
    assert match, (
        f"Log line in {OUTPUT_LOG} must match `Job ID: <job_id>`; got: {lines[0]!r}"
    )
    return match.group("job_id")


def test_script_file_exists():
    assert os.path.isfile(SCRIPT_PATH), f"Expected extraction script at {SCRIPT_PATH}."
    assert os.path.getsize(SCRIPT_PATH) > 0, f"Extraction script at {SCRIPT_PATH} must be non-empty."


def test_output_json_has_required_keys(parsed_output):
    for key in ("name", "email", "skills"):
        assert key in parsed_output, f"Expected key {key!r} in {OUTPUT_JSON}; got keys: {sorted(parsed_output)}"


def test_output_json_name_value(parsed_output):
    name = parsed_output.get("name")
    assert isinstance(name, str), f"`name` must be a string; got {type(name).__name__}."
    assert EXPECTED_NAME_SUBSTR in name.lower(), (
        f"`name` should contain {EXPECTED_NAME_SUBSTR!r} (case-insensitive); got {name!r}."
    )


def test_output_json_email_value(parsed_output):
    email = parsed_output.get("email")
    assert isinstance(email, str), f"`email` must be a string; got {type(email).__name__}."
    assert email.strip().lower() == EXPECTED_EMAIL, (
        f"`email` should equal {EXPECTED_EMAIL!r}; got {email!r}."
    )


def test_output_json_skills_value(parsed_output):
    skills = parsed_output.get("skills")
    assert isinstance(skills, list) and all(isinstance(s, str) for s in skills), (
        "`skills` must be a list of strings."
    )
    assert len(skills) >= 3, f"Expected at least 3 skills; got {len(skills)}: {skills!r}"
    joined = " ".join(skills).lower()
    matched = [kw for kw in EXPECTED_SKILL_KEYWORDS if kw in joined]
    assert len(matched) >= 3, (
        f"Expected at least 3 of {EXPECTED_SKILL_KEYWORDS!r} to appear in skills; "
        f"matched {matched!r} in {skills!r}."
    )


def test_extract_job_completed_via_sdk(job_id):
    client = _llama_client()
    job = client.extract.get(job_id)
    status = getattr(job, "status", None)
    assert status == "COMPLETED", (
        f"Extract job {job_id} must be COMPLETED; got status={status!r}."
    )
    result = getattr(job, "extract_result", None)
    assert isinstance(result, dict) and result, (
        f"Extract job {job_id} must expose a non-empty `extract_result` dict; got {result!r}."
    )
    name = result.get("name")
    email = result.get("email")
    skills = result.get("skills")
    assert isinstance(name, str) and EXPECTED_NAME_SUBSTR in name.lower(), (
        f"SDK extract_result.name should contain {EXPECTED_NAME_SUBSTR!r}; got {name!r}."
    )
    assert isinstance(email, str) and email.strip().lower() == EXPECTED_EMAIL, (
        f"SDK extract_result.email should equal {EXPECTED_EMAIL!r}; got {email!r}."
    )
    assert isinstance(skills, list) and len(skills) >= 3, (
        f"SDK extract_result.skills should be a list of >= 3 strings; got {skills!r}."
    )


def test_uploaded_file_has_run_id_external_id():
    run_id = _run_id()
    expected_external_id = f"harbor-resume-{run_id}"
    client = _llama_client()

    seen_external_ids = []
    found = False
    page = client.files.list()
    for _ in range(20):  # safety bound on pagination
        items = getattr(page, "items", None) or getattr(page, "data", None) or []
        for item in items:
            external_id = getattr(item, "external_file_id", None)
            if external_id is None and isinstance(item, dict):
                external_id = item.get("external_file_id")
            if external_id:
                seen_external_ids.append(external_id)
            if external_id == expected_external_id:
                found = True
                break
        if found:
            break
        if not hasattr(page, "has_next_page") or not page.has_next_page():
            break
        page = page.get_next_page()

    assert found, (
        f"Expected to find an uploaded file with external_file_id={expected_external_id!r}; "
        f"observed external_file_ids (truncated): {seen_external_ids[:10]!r}"
    )
