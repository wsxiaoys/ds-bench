import os
import re

import pytest


LOG_FILE = "/home/user/myproject/output.log"


@pytest.fixture(scope="module")
def log_contents():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file {LOG_FILE} to exist after the task is complete."
    )
    with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def test_branch_line_is_master(log_contents):
    branch_lines = [
        line for line in log_contents.splitlines() if line.startswith("Branch:")
    ]
    assert branch_lines, (
        "Expected a line of the form 'Branch: <name>' in the log file "
        f"{LOG_FILE}, but none was found. Log content was:\n{log_contents}"
    )

    branch_pattern = re.compile(r"^Branch:\s*master\s*$")
    matching = [line for line in branch_lines if branch_pattern.match(line)]
    assert matching, (
        "Expected the log file to contain a line exactly matching "
        "'Branch: master' (Hello-World's default branch), but found: "
        f"{branch_lines}"
    )


def test_readme_line_contains_hello_world(log_contents):
    readme_lines = [
        line for line in log_contents.splitlines() if line.startswith("README:")
    ]
    assert readme_lines, (
        "Expected a line of the form 'README: <first line>' in the log file "
        f"{LOG_FILE}, but none was found. Log content was:\n{log_contents}"
    )

    matching = [line for line in readme_lines if "Hello World!" in line]
    assert matching, (
        "Expected the README line in the log file to contain 'Hello World!' "
        "(the first line of octocat/Hello-World's README), but found: "
        f"{readme_lines}"
    )


def test_sandbox_was_deleted():
    """Verify the task-created sandbox no longer exists in Daytona Cloud."""
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, (
        "DAYTONA_API_KEY must be set in the verifier environment to confirm "
        "sandbox deletion."
    )

    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "ZEALT_RUN_ID must be set in the verifier environment to determine the "
        "sandbox name to look up."
    )

    sandbox_name = f"git-py-{run_id}"

    from daytona import Daytona, DaytonaConfig

    daytona = Daytona(DaytonaConfig(api_key=api_key))
    sandboxes = daytona.list()

    leftover = []
    for sb in sandboxes:
        # Sandbox name can be on different attributes depending on SDK version
        name = (
            getattr(sb, "name", None)
            or getattr(getattr(sb, "labels", None), "name", None)
            or ""
        )
        labels = getattr(sb, "labels", None) or {}
        label_name = ""
        if isinstance(labels, dict):
            label_name = labels.get("name", "") or ""
        if name == sandbox_name or label_name == sandbox_name:
            leftover.append(sb)

    assert not leftover, (
        f"Expected sandbox named '{sandbox_name}' to be deleted, but it is "
        "still present in Daytona Cloud."
    )
