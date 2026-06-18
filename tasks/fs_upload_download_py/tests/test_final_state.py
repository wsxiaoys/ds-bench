import os

PROJECT_DIR = "/home/user/myproject"
INPUT_FILE = os.path.join(PROJECT_DIR, "input.txt")
OUTPUT_FILE = os.path.join(PROJECT_DIR, "output.txt")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable must be set for verification."
    return run_id


def test_input_file_exists_with_expected_content():
    assert os.path.isfile(INPUT_FILE), (
        f"Expected local input file at {INPUT_FILE} to be present after the task ran."
    )
    run_id = _run_id()
    expected = f"Hello Daytona {run_id}"
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    # Allow an optional trailing newline since editors/tools sometimes add one.
    assert content.rstrip("\n") == expected, (
        f"Input file {INPUT_FILE} content mismatch. "
        f"Expected: {expected!r}, got: {content!r}"
    )


def test_output_file_exists_with_uppercased_content():
    assert os.path.isfile(OUTPUT_FILE), (
        f"Expected downloaded output file at {OUTPUT_FILE} to be present "
        f"after the task ran."
    )
    run_id = _run_id()
    # `tr a-z A-Z` uppercases letters; digits and hyphens are preserved.
    expected = f"HELLO DAYTONA {run_id.upper()}"
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content.rstrip("\n") == expected, (
        f"Output file {OUTPUT_FILE} content mismatch. "
        f"Expected uppercased content: {expected!r}, got: {content!r}"
    )


def test_log_file_contains_ok_line():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file at {LOG_FILE} to be present after the task ran."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        log_content = f.read()
    assert "Upload+Download OK" in log_content.splitlines() or \
        "Upload+Download OK" in log_content, (
        f"Expected log file {LOG_FILE} to contain the line 'Upload+Download OK'. "
        f"Got: {log_content!r}"
    )
