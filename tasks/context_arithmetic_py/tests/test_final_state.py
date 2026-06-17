import json
import os
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/myproject"
MAIN_PY = os.path.join(PROJECT_DIR, "main.py")
REQUIREMENTS_TXT = os.path.join(PROJECT_DIR, "requirements.txt")


def _run_cli(groups):
    """Run `python3 main.py --groups <groups>` and return (returncode, stdout, stderr)."""
    env = os.environ.copy()
    cmd = ["python3", "main.py", "--groups", *groups]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=env,
        timeout=300,
    )
    return result.returncode, result.stdout, result.stderr


def _parse_last_json_array(stdout):
    """Find and parse the last non-empty line of stdout as a JSON array."""
    lines = [ln for ln in stdout.splitlines() if ln.strip()]
    assert lines, "CLI produced no non-empty stdout output."
    last = lines[-1].strip()
    try:
        parsed = json.loads(last)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Last non-empty stdout line is not valid JSON: {last!r}. Error: {exc}"
        )
    assert isinstance(parsed, list), (
        f"Expected a JSON array as the last stdout line, got: {type(parsed).__name__}: {parsed!r}"
    )
    return parsed


def _file_names_from_output(items):
    names = []
    for i, item in enumerate(items):
        assert isinstance(item, dict), (
            f"Output element #{i} is not a JSON object: {item!r}"
        )
        assert "file_name" in item, (
            f"Output element #{i} is missing required key 'file_name': {item!r}"
        )
        assert isinstance(item["file_name"], str), (
            f"Output element #{i} has non-string 'file_name': {item!r}"
        )
        names.append(item["file_name"])
    return names


@pytest.fixture(scope="session")
def run_id():
    rid = os.environ.get("ZEALT_RUN_ID")
    assert rid, "ZEALT_RUN_ID environment variable must be set for verification."
    return rid


def test_main_py_exists():
    assert os.path.isfile(MAIN_PY), f"Expected CLI entrypoint at {MAIN_PY}."


def test_requirements_txt_exists_and_lists_sdk():
    assert os.path.isfile(REQUIREMENTS_TXT), (
        f"Expected requirements.txt at {REQUIREMENTS_TXT}."
    )
    content = Path(REQUIREMENTS_TXT).read_text().lower()
    assert "alchemystai" in content or "alchemyst_ai" in content or "alchemyst-ai" in content, (
        f"requirements.txt must declare the 'alchemystai' dependency. Got:\n{content}"
    )


def test_intersection_eng_and_v1(run_id):
    """Primary case: eng ∩ v1 should return only docA."""
    returncode, stdout, stderr = _run_cli(["eng", "v1"])
    assert returncode == 0, (
        f"CLI exited with non-zero code {returncode}. Stderr:\n{stderr}\nStdout:\n{stdout}"
    )
    items = _parse_last_json_array(stdout)
    names = set(_file_names_from_output(items))
    expected = {f"docA-{run_id}.md"}
    assert names == expected, (
        f"Expected file_name set {expected} for --groups eng v1, got {names}. "
        f"Stdout:\n{stdout}\nStderr:\n{stderr}"
    )


def test_intersection_eng_and_v2(run_id):
    """eng ∩ v2 should return only docB."""
    returncode, stdout, stderr = _run_cli(["eng", "v2"])
    assert returncode == 0, (
        f"CLI exited with non-zero code {returncode}. Stderr:\n{stderr}\nStdout:\n{stdout}"
    )
    items = _parse_last_json_array(stdout)
    names = set(_file_names_from_output(items))
    expected = {f"docB-{run_id}.md"}
    assert names == expected, (
        f"Expected file_name set {expected} for --groups eng v2, got {names}. "
        f"Stdout:\n{stdout}\nStderr:\n{stderr}"
    )


def test_intersection_docs_and_v1(run_id):
    """docs ∩ v1 should return only docC."""
    returncode, stdout, stderr = _run_cli(["docs", "v1"])
    assert returncode == 0, (
        f"CLI exited with non-zero code {returncode}. Stderr:\n{stderr}\nStdout:\n{stdout}"
    )
    items = _parse_last_json_array(stdout)
    names = set(_file_names_from_output(items))
    expected = {f"docC-{run_id}.md"}
    assert names == expected, (
        f"Expected file_name set {expected} for --groups docs v1, got {names}. "
        f"Stdout:\n{stdout}\nStderr:\n{stdout}"
    )


def test_single_group_v1(run_id):
    """Filtering by --groups v1 should return docA and docC."""
    returncode, stdout, stderr = _run_cli(["v1"])
    assert returncode == 0, (
        f"CLI exited with non-zero code {returncode}. Stderr:\n{stderr}\nStdout:\n{stdout}"
    )
    items = _parse_last_json_array(stdout)
    names = set(_file_names_from_output(items))
    expected = {f"docA-{run_id}.md", f"docC-{run_id}.md"}
    assert names == expected, (
        f"Expected file_name set {expected} for --groups v1, got {names}. "
        f"Stdout:\n{stdout}\nStderr:\n{stderr}"
    )


def test_empty_intersection_eng_and_docs(run_id):
    """eng ∩ docs has no member documents; output must be an empty JSON array."""
    returncode, stdout, stderr = _run_cli(["eng", "docs"])
    assert returncode == 0, (
        f"CLI exited with non-zero code {returncode}. Stderr:\n{stderr}\nStdout:\n{stdout}"
    )
    items = _parse_last_json_array(stdout)
    assert items == [], (
        f"Expected an empty JSON array for --groups eng docs, got {items}. "
        f"Stdout:\n{stdout}\nStderr:\n{stderr}"
    )


def test_rerunnable_no_409(run_id):
    """Running the same command twice in a row must not raise 409 Conflict."""
    rc1, out1, err1 = _run_cli(["eng", "v1"])
    assert rc1 == 0, (
        f"First invocation failed (rc={rc1}). Stderr:\n{err1}\nStdout:\n{out1}"
    )
    rc2, out2, err2 = _run_cli(["eng", "v1"])
    assert rc2 == 0, (
        f"Second invocation failed (rc={rc2}). The CLI must be rerunnable and "
        f"must NOT propagate 409 Conflict. Stderr:\n{err2}\nStdout:\n{out2}"
    )
    combined = (out2 + "\n" + err2).lower()
    assert "409" not in combined and "conflict" not in combined, (
        f"Second invocation surfaced a 409/Conflict error. Stderr:\n{err2}\nStdout:\n{out2}"
    )
    names1 = set(_file_names_from_output(_parse_last_json_array(out1)))
    names2 = set(_file_names_from_output(_parse_last_json_array(out2)))
    assert names1 == names2 == {f"docA-{run_id}.md"}, (
        f"Rerun produced inconsistent results. First: {names1}, second: {names2}"
    )
