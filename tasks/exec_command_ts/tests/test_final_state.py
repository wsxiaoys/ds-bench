import os
import re

PROJECT_DIR = "/home/user/myproject"
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")


def _read_log() -> str:
    assert os.path.isfile(LOG_PATH), (
        f"Expected the task to create {LOG_PATH}, but the file does not exist."
    )
    with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def test_output_log_exists():
    assert os.path.isfile(LOG_PATH), (
        f"output.log not found at {LOG_PATH}; the task must write captured "
        f"sandbox command output to this file."
    )


def test_log_contains_os_release_line():
    """The log must contain a line prefixed with 'OS: ' and the captured
    payload from `cat /etc/os-release` (which always contains os-release
    fields such as ID= or PRETTY_NAME=)."""
    content = _read_log()

    os_prefix_present = bool(
        re.search(r"(?m)^OS:\s", content)
    )
    assert os_prefix_present, (
        "output.log must contain a line starting with 'OS: ' followed by the "
        "captured output of `cat /etc/os-release`."
    )

    # After the OS: prefix we expect identifying os-release content; because
    # the captured payload may be multi-line, search the whole file for the
    # tokens that are guaranteed to appear in /etc/os-release.
    os_marker_present = bool(
        re.search(r"\bID=", content) or re.search(r"\bPRETTY_NAME=", content)
    )
    assert os_marker_present, (
        "The OS: section in output.log does not contain recognizable "
        "/etc/os-release fields (expected at least one of `ID=` or "
        "`PRETTY_NAME=`)."
    )


def test_log_contains_node_version_line():
    """The log must contain a line prefixed with 'NODE: ' and a value
    matching the Node.js version pattern (`vMAJOR.MINOR.PATCH`)."""
    content = _read_log()

    match = re.search(r"(?m)^NODE:\s*(.*)$", content)
    assert match is not None, (
        "output.log must contain a line starting with 'NODE: ' followed by "
        "the captured output of `node --version`."
    )

    node_value = match.group(1).strip()
    assert re.search(r"v\d+\.\d+\.\d+", node_value), (
        f"The NODE: line value '{node_value}' does not match a Node.js "
        f"version string of the form `vMAJOR.MINOR.PATCH`."
    )


def test_log_contains_echo_run_id_line():
    """The log must contain a line prefixed with 'ECHO: ' followed by the
    same value as the ZEALT_RUN_ID environment variable."""
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, (
        "ZEALT_RUN_ID environment variable must be set during verification "
        "so the echoed sandbox value can be checked."
    )

    content = _read_log()
    match = re.search(r"(?m)^ECHO:\s*(.*)$", content)
    assert match is not None, (
        "output.log must contain a line starting with 'ECHO: ' followed by "
        "the captured output of `echo ${ZEALT_RUN_ID}` from inside the "
        "sandbox."
    )

    echo_value = match.group(1).strip()
    assert echo_value == run_id, (
        f"The ECHO: line value '{echo_value}' does not match the expected "
        f"ZEALT_RUN_ID value '{run_id}'."
    )
