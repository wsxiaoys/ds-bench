import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
SANDBOXES_JSON = os.path.join(PROJECT_DIR, "sandboxes.json")
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")


@pytest.fixture(scope="session")
def run_id():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, "ZEALT_RUN_ID environment variable must be set for verification."
    return value


@pytest.fixture(scope="session")
def expected_sandbox_name(run_id):
    return f"lst-{run_id}"


@pytest.fixture(scope="session")
def sandboxes_data():
    assert os.path.isfile(SANDBOXES_JSON), (
        f"Expected sandboxes JSON file at {SANDBOXES_JSON} but it does not exist."
    )
    with open(SANDBOXES_JSON, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            pytest.fail(
                f"Could not parse {SANDBOXES_JSON} as JSON: {e}"
            )
    return data


def _iter_sandbox_entries(data):
    """Yield individual sandbox dicts from a `daytona list --format json` result.

    The output is expected to be a JSON list of sandbox objects, but we
    defensively handle the case where it could be a dict wrapping a list under
    a common key.
    """
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                yield item
        return
    if isinstance(data, dict):
        for key in ("sandboxes", "items", "data"):
            value = data.get(key)
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        yield item
                return


def test_sandboxes_json_contains_created_sandbox(sandboxes_data, expected_sandbox_name):
    entries = list(_iter_sandbox_entries(sandboxes_data))
    assert entries, (
        f"sandboxes.json does not contain any sandbox entries; raw content: {sandboxes_data!r}"
    )
    matches = [e for e in entries if e.get("name") == expected_sandbox_name]
    assert matches, (
        f"Expected to find a sandbox named '{expected_sandbox_name}' in {SANDBOXES_JSON}, "
        f"but only found names: {[e.get('name') for e in entries]}"
    )
    assert len(matches) == 1, (
        f"Expected exactly one sandbox named '{expected_sandbox_name}' in {SANDBOXES_JSON}, "
        f"but found {len(matches)}."
    )
    assert matches[0].get("id"), (
        f"Sandbox entry for '{expected_sandbox_name}' is missing an 'id' field: {matches[0]!r}"
    )


def test_output_log_summary_line(sandboxes_data, expected_sandbox_name):
    assert os.path.isfile(OUTPUT_LOG), (
        f"Expected log file at {OUTPUT_LOG} but it does not exist."
    )
    with open(OUTPUT_LOG, "r") as f:
        content = f.read()

    matches = [e for e in _iter_sandbox_entries(sandboxes_data) if e.get("name") == expected_sandbox_name]
    assert matches, (
        f"Cannot verify summary because no sandbox named '{expected_sandbox_name}' exists in {SANDBOXES_JSON}."
    )
    sandbox_id = matches[0]["id"]
    expected_line = f"Created: {expected_sandbox_name} with id {sandbox_id}"

    lines = [line.strip() for line in content.splitlines() if line.strip()]
    assert expected_line in lines, (
        f"Expected log line '{expected_line}' in {OUTPUT_LOG}, but found lines: {lines!r}"
    )


def test_output_log_format_matches_pattern(expected_sandbox_name):
    assert os.path.isfile(OUTPUT_LOG), (
        f"Expected log file at {OUTPUT_LOG} but it does not exist."
    )
    with open(OUTPUT_LOG, "r") as f:
        content = f.read()
    pattern = re.compile(
        rf"^Created:\s+{re.escape(expected_sandbox_name)}\s+with id\s+\S+\s*$",
        re.MULTILINE,
    )
    assert pattern.search(content), (
        f"output.log does not contain a line matching the required summary format. "
        f"Expected pattern 'Created: {expected_sandbox_name} with id <sandbox-id>'. "
        f"Actual content: {content!r}"
    )
