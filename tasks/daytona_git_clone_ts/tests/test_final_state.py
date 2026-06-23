import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _read_log():
    assert os.path.isfile(LOG_FILE), f"Expected log file {LOG_FILE} to exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def _run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable must be set for verification."
    return run_id


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Expected log file at {LOG_FILE}."


def test_branch_line_is_main():
    content = _read_log()
    match = re.search(r"^Branch:\s*(\S+)\s*$", content, re.MULTILINE)
    assert match is not None, (
        f"Expected a 'Branch: <name>' line in {LOG_FILE}; got:\n{content}"
    )
    branch = match.group(1).strip()
    assert branch == "main", (
        f"Expected branch name 'main' for octocat/Spoon-Knife, got '{branch}'."
    )


def test_files_line_contains_index_and_readme():
    content = _read_log()
    match = re.search(r"^Files:\s*(.+)$", content, re.MULTILINE)
    assert match is not None, (
        f"Expected a 'Files: <comma-separated names>' line in {LOG_FILE}; got:\n{content}"
    )
    raw = match.group(1)
    files = {entry.strip() for entry in raw.split(",") if entry.strip()}
    assert "index.html" in files, (
        f"Expected 'index.html' among cloned files, got: {sorted(files)}"
    )
    assert "README.md" in files, (
        f"Expected 'README.md' among cloned files, got: {sorted(files)}"
    )


def test_sandbox_was_deleted():
    run_id = _run_id()
    expected_name = f"git-ts-{run_id}"

    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, "DAYTONA_API_KEY must be set to verify sandbox cleanup."

    daytona_mod = pytest.importorskip("daytona")
    Daytona = getattr(daytona_mod, "Daytona", None)
    DaytonaConfig = getattr(daytona_mod, "DaytonaConfig", None)
    assert Daytona is not None and DaytonaConfig is not None, (
        "daytona SDK must expose Daytona and DaytonaConfig."
    )

    client = Daytona(
        DaytonaConfig(api_key=api_key, server_url="https://app.daytona.io/api")
    )
    sandboxes = client.list()
    matching = []
    for sb in sandboxes:
        name = None
        # Try common attribute locations for sandbox name/labels.
        for attr in ("name",):
            name = getattr(sb, attr, None)
            if name:
                break
        if not name:
            labels = getattr(sb, "labels", None) or {}
            if isinstance(labels, dict):
                name = labels.get("name")
        if name == expected_name:
            matching.append(sb)

    assert not matching, (
        f"Expected no sandbox named '{expected_name}' after task completion, "
        f"but found {len(matching)}."
    )
