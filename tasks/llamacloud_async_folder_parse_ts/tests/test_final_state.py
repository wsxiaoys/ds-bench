import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
INPUTS_DIR = os.path.join(PROJECT_DIR, "inputs")
OUTPUTS_DIR = os.path.join(PROJECT_DIR, "outputs")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

EXPECTED_BASENAMES = ["attention", "bert", "gpt3"]


@pytest.fixture(scope="session")
def run_id():
    rid = os.environ.get("ZEALT_RUN_ID", "")
    assert rid, "ZEALT_RUN_ID is not set in the verifier environment."
    return rid


def test_outputs_directory_exists():
    assert os.path.isdir(OUTPUTS_DIR), (
        f"Expected outputs directory {OUTPUTS_DIR} to exist."
    )


@pytest.mark.parametrize("basename", EXPECTED_BASENAMES)
def test_markdown_output_exists_and_nonempty(basename):
    md_path = os.path.join(OUTPUTS_DIR, f"{basename}.md")
    assert os.path.isfile(md_path), f"Expected markdown output {md_path} to exist."
    size = os.path.getsize(md_path)
    assert size > 0, f"Markdown output {md_path} is empty (size=0)."
    with open(md_path, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()
    assert len(content.strip()) >= 100, (
        f"Markdown output {md_path} is too short ({len(content)} chars); "
        f"expected at least 100 characters of parsed content."
    )


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Expected log file {LOG_FILE} to exist."


@pytest.mark.parametrize("basename", EXPECTED_BASENAMES)
def test_log_contains_summary_line(basename):
    assert os.path.isfile(LOG_FILE), f"Expected log file {LOG_FILE} to exist."
    with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as fh:
        log_text = fh.read()
    pattern = re.compile(
        rf"^Parsed: {re.escape(basename)}\.pdf \| pages: (\d+)\s*$",
        re.MULTILINE,
    )
    matches = pattern.findall(log_text)
    assert matches, (
        f"Expected one line matching 'Parsed: {basename}.pdf | pages: <N>' "
        f"in {LOG_FILE}, but got:\n{log_text}"
    )
    page_count = int(matches[0])
    assert page_count >= 1, (
        f"Page count for {basename}.pdf must be >= 1, got {page_count}."
    )


def test_external_file_id_uses_run_id(run_id):
    """Verify uploads were tagged with the current run-id via the LlamaCloud SDK."""
    from llama_cloud import LlamaCloud

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert api_key, "LLAMA_CLOUD_API_KEY is not set in the verifier environment."

    client = LlamaCloud(api_key=api_key)

    found_basenames = set()
    expected_prefix = f"{run_id}-"

    # Try to query each basename directly first; fall back to listing.
    for basename in EXPECTED_BASENAMES:
        external_id = f"{run_id}-{basename}"
        try:
            queried = client.files.query(external_file_id=external_id)
        except Exception:
            queried = None

        if queried:
            # `query` returns a list-like or single object depending on SDK shape.
            items = queried if isinstance(queried, list) else [queried]
            for item in items:
                ext = getattr(item, "external_file_id", None)
                if ext and ext.startswith(expected_prefix):
                    found_basenames.add(basename)

    if len(found_basenames) < len(EXPECTED_BASENAMES):
        # Fallback: enumerate recent files and look for the prefix.
        try:
            page = client.files.list()
            iterator = page if hasattr(page, "__iter__") else getattr(page, "data", [])
            for f in iterator:
                ext = getattr(f, "external_file_id", None) or ""
                if not ext.startswith(expected_prefix):
                    continue
                tail = ext[len(expected_prefix):]
                for basename in EXPECTED_BASENAMES:
                    if tail == basename or tail.startswith(basename):
                        found_basenames.add(basename)
        except Exception as exc:
            pytest.fail(
                f"Unable to verify external_file_id tagging via LlamaCloud SDK: {exc}"
            )

    missing = set(EXPECTED_BASENAMES) - found_basenames
    assert not missing, (
        f"Could not find LlamaCloud uploads tagged with external_file_id "
        f"prefix '{expected_prefix}' for: {sorted(missing)}. "
        f"Each upload must be tagged with '{expected_prefix}<basename>'."
    )
