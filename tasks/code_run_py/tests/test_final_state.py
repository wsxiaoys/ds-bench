import os
import re

PROJECT_DIR = "/home/user/myproject"
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")


def test_output_log_exists():
    assert os.path.isfile(OUTPUT_LOG), (
        f"Expected log file {OUTPUT_LOG} to exist after the task runs."
    )


def test_output_log_contains_expected_result():
    with open(OUTPUT_LOG, "r", encoding="utf-8") as f:
        content = f.read()
    pattern = re.compile(r"^Result:\s*5050\s*$", re.MULTILINE)
    assert pattern.search(content) is not None, (
        f"Expected {OUTPUT_LOG} to contain a line 'Result: 5050' (sum of 1..100). "
        f"Actual contents: {content!r}"
    )
