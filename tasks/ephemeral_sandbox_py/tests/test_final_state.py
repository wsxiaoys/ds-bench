import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _read_log():
    assert os.path.isfile(LOG_FILE), (
        f"Expected output log file at {LOG_FILE} but it does not exist."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), (
        f"Expected output log file at {LOG_FILE} but it does not exist."
    )


def test_log_contains_year_line():
    content = _read_log()
    match = re.search(r"^Year:\s*(\d{4})\s*$", content, re.MULTILINE)
    assert match is not None, (
        "Expected a line matching 'Year: <YYYY>' (4-digit year) in "
        f"{LOG_FILE}. Actual content:\n{content}"
    )
    year = int(match.group(1))
    assert year >= 2024, (
        f"Expected year >= 2024 reported from the Daytona sandbox, "
        f"got {year}. Actual log content:\n{content}"
    )


def test_log_contains_autostop_line():
    content = _read_log()
    match = re.search(r"^AutoStop:\s*(\-?\d+)\s*$", content, re.MULTILINE)
    assert match is not None, (
        "Expected a line matching 'AutoStop: <minutes>' (integer) in "
        f"{LOG_FILE}. Actual content:\n{content}"
    )
    minutes = int(match.group(1))
    assert minutes == 5, (
        "Expected 'AutoStop: 5' in the log (matching the "
        f"auto_stop_interval=5 used at sandbox creation), got AutoStop: {minutes}. "
        f"Actual log content:\n{content}"
    )
