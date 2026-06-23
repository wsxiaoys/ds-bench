import os
import re

OUTPUT_LOG = "/home/user/myproject/output.log"


def test_output_log_exists():
    """The task must produce the output log file."""
    assert os.path.isfile(OUTPUT_LOG), f"Expected log file {OUTPUT_LOG} does not exist."


def test_output_log_contains_factorial_720():
    """The log file must contain a line matching the format 'Factorial: 720' (6! = 720)."""
    with open(OUTPUT_LOG) as f:
        content = f.read()
    pattern = re.compile(r"^\s*Factorial:\s*720\s*$", re.MULTILINE)
    assert pattern.search(content) is not None, (
        f"Expected a line matching 'Factorial: 720' in {OUTPUT_LOG}, got:\n{content!r}"
    )
