import os
import re

LOG_FILE = "/home/user/myproject/output.log"


def _read_log():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file {LOG_FILE} to exist after the task runs."
    )
    with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _find_prefixed_line(content: str, prefix: str):
    """Return the first line that starts with the given prefix, else None."""
    for line in content.splitlines():
        if line.startswith(prefix):
            return line
    return None


def test_log_file_exists_and_nonempty():
    content = _read_log()
    assert content.strip() != "", (
        f"Log file {LOG_FILE} exists but is empty; expected UNAME/PWD/ECHO lines."
    )


def test_uname_line_present_and_contains_linux():
    content = _read_log()
    line = _find_prefixed_line(content, "UNAME: ")
    assert line is not None, (
        f"Expected a line starting with 'UNAME: ' in {LOG_FILE}, but none was found."
    )
    remainder = line[len("UNAME: "):]
    assert "Linux" in remainder, (
        f"Expected the UNAME line to contain 'Linux' (output of `uname -a`), got: {line!r}"
    )


def test_pwd_line_present_and_nonempty_path():
    content = _read_log()
    line = _find_prefixed_line(content, "PWD: ")
    assert line is not None, (
        f"Expected a line starting with 'PWD: ' in {LOG_FILE}, but none was found."
    )
    remainder = line[len("PWD: "):].strip()
    assert remainder != "", (
        f"Expected the PWD line to contain a non-empty path, got: {line!r}"
    )
    assert re.match(r"^/", remainder), (
        f"Expected the PWD line to contain an absolute path starting with '/', got: {line!r}"
    )


def test_echo_line_matches_zealt_run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id is not None and run_id.strip() != "", (
        "ZEALT_RUN_ID must be set in the verifier environment to validate the ECHO line."
    )
    content = _read_log()
    line = _find_prefixed_line(content, "ECHO: ")
    assert line is not None, (
        f"Expected a line starting with 'ECHO: ' in {LOG_FILE}, but none was found."
    )
    remainder = line[len("ECHO: "):].strip()
    assert remainder == run_id, (
        f"Expected the ECHO line to match ZEALT_RUN_ID={run_id!r}, got: {remainder!r}"
    )


def test_lines_appear_in_required_order():
    content = _read_log()
    lines = content.splitlines()
    uname_idx = next((i for i, l in enumerate(lines) if l.startswith("UNAME: ")), -1)
    pwd_idx = next((i for i, l in enumerate(lines) if l.startswith("PWD: ")), -1)
    echo_idx = next((i for i, l in enumerate(lines) if l.startswith("ECHO: ")), -1)
    assert uname_idx != -1, f"UNAME line missing in {LOG_FILE}."
    assert pwd_idx != -1, f"PWD line missing in {LOG_FILE}."
    assert echo_idx != -1, f"ECHO line missing in {LOG_FILE}."
    assert uname_idx < pwd_idx < echo_idx, (
        f"Expected UNAME, then PWD, then ECHO order in {LOG_FILE}; "
        f"got indices UNAME={uname_idx}, PWD={pwd_idx}, ECHO={echo_idx}."
    )
