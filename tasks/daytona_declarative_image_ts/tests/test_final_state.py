import os
import re

LOG_FILE = "/home/user/myproject/output.log"


def _read_log_lines():
    assert os.path.isfile(LOG_FILE), f"Expected log file {LOG_FILE} to exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content.strip() != "", f"Log file {LOG_FILE} is empty."
    return [line.rstrip() for line in content.splitlines() if line.strip() != ""]


def test_output_log_exists_and_nonempty():
    lines = _read_log_lines()
    assert len(lines) >= 2, (
        f"Expected at least 2 non-empty lines in {LOG_FILE} (flask version and click version), "
        f"got {len(lines)}: {lines!r}"
    )


def test_output_log_contains_flask_version_line():
    lines = _read_log_lines()
    # Pattern: a line starting with `flask ` followed by a non-empty version token
    flask_re = re.compile(r"^flask\s+\S+\s*$")
    matching = [ln for ln in lines if flask_re.match(ln)]
    assert matching, (
        f"Expected a line starting with 'flask ' followed by a non-empty version in {LOG_FILE}. "
        f"Got lines: {lines!r}"
    )
    # Sanity-check that the version token is not just a literal placeholder
    version = matching[0].split(None, 1)[1].strip()
    assert version and version.lower() not in {"none", "null", "version"}, (
        f"Flask version token looks invalid: {version!r}"
    )


def test_output_log_contains_click_version_line():
    lines = _read_log_lines()
    click_re = re.compile(r"^click\s+\S+\s*$")
    matching = [ln for ln in lines if click_re.match(ln)]
    assert matching, (
        f"Expected a line starting with 'click ' followed by a non-empty version in {LOG_FILE}. "
        f"Got lines: {lines!r}"
    )
    version = matching[0].split(None, 1)[1].strip()
    assert version and version.lower() not in {"none", "null", "version"}, (
        f"Click version token looks invalid: {version!r}"
    )
