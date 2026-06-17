import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
MARKDOWN_FILE = os.path.join(OUTPUT_DIR, "markdown.md")
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
LOG_FILE = os.path.join(OUTPUT_DIR, "output.log")

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
IMAGE_NAME_RE = re.compile(r"^page_(\d+)\.png$")
JOB_ID_RE = re.compile(r"^Parse job ID:\s+(pjb-[A-Za-z0-9_-]+)\s*$", re.MULTILINE)
MD_CHARS_RE = re.compile(r"^Markdown chars:\s+(\d+)\s*$", re.MULTILINE)
IMG_COUNT_RE = re.compile(r"^Image count:\s+(\d+)\s*$", re.MULTILINE)


def _read_log():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def test_log_file_exists_and_contains_job_id():
    content = _read_log()
    match = JOB_ID_RE.search(content)
    assert match, (
        f"Log file {LOG_FILE} is missing a line of the form 'Parse job ID: pjb-...'. Contents:\n{content}"
    )


def test_log_file_contains_markdown_chars():
    content = _read_log()
    match = MD_CHARS_RE.search(content)
    assert match, (
        f"Log file {LOG_FILE} is missing a line of the form 'Markdown chars: <n>'. Contents:\n{content}"
    )


def test_log_file_contains_image_count():
    content = _read_log()
    match = IMG_COUNT_RE.search(content)
    assert match, (
        f"Log file {LOG_FILE} is missing a line of the form 'Image count: <n>'. Contents:\n{content}"
    )
    assert int(match.group(1)) >= 1, (
        f"'Image count' in {LOG_FILE} must be >= 1; got {match.group(1)}."
    )


def test_markdown_file_exists_and_non_empty():
    assert os.path.isfile(MARKDOWN_FILE), f"Markdown file {MARKDOWN_FILE} does not exist."
    with open(MARKDOWN_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert len(content) >= 50, (
        f"Markdown file {MARKDOWN_FILE} has only {len(content)} characters; expected at least 50."
    )


def test_markdown_chars_matches_file_length():
    content = _read_log()
    match = MD_CHARS_RE.search(content)
    assert match, f"Log file is missing 'Markdown chars: <n>' entry."
    reported = int(match.group(1))
    with open(MARKDOWN_FILE, "r", encoding="utf-8") as f:
        actual = len(f.read())
    assert reported == actual, (
        f"'Markdown chars: {reported}' in log does not match actual markdown file length ({actual})."
    )


def test_images_directory_exists():
    assert os.path.isdir(IMAGES_DIR), f"Images directory {IMAGES_DIR} does not exist."


def test_images_directory_contains_at_least_one_page_png():
    entries = sorted(os.listdir(IMAGES_DIR))
    page_pngs = [e for e in entries if IMAGE_NAME_RE.match(e)]
    assert len(page_pngs) >= 1, (
        f"Expected at least one 'page_<N>.png' file under {IMAGES_DIR}; found entries: {entries}."
    )


def test_every_image_file_has_correct_name_and_png_magic():
    entries = sorted(os.listdir(IMAGES_DIR))
    assert entries, f"Images directory {IMAGES_DIR} is empty."
    for name in entries:
        match = IMAGE_NAME_RE.match(name)
        assert match, (
            f"File '{name}' in {IMAGES_DIR} does not match required pattern 'page_<N>.png'."
        )
        page_num = int(match.group(1))
        assert page_num >= 1, (
            f"Page number in filename '{name}' must be a positive integer (1-based)."
        )
        path = os.path.join(IMAGES_DIR, name)
        with open(path, "rb") as f:
            header = f.read(8)
        assert header.startswith(PNG_MAGIC), (
            f"File {path} is not a valid PNG (missing PNG magic bytes)."
        )


def test_image_count_matches_actual_files():
    content = _read_log()
    match = IMG_COUNT_RE.search(content)
    assert match, "Log file is missing 'Image count: <n>' entry."
    reported = int(match.group(1))
    page_pngs = [e for e in os.listdir(IMAGES_DIR) if IMAGE_NAME_RE.match(e)]
    assert reported == len(page_pngs), (
        f"'Image count: {reported}' in log does not match number of page_<N>.png files on disk ({len(page_pngs)})."
    )


def test_parse_job_exists_in_llamacloud():
    """Use the LlamaCloud SDK to verify the parse job actually ran on the service."""
    try:
        from llama_cloud import LlamaCloud
    except Exception as exc:  # pragma: no cover - diagnostic message
        pytest.fail(f"`llama_cloud` SDK is not importable in the verifier env: {exc}")

    content = _read_log()
    match = JOB_ID_RE.search(content)
    assert match, "Log file is missing 'Parse job ID: pjb-...' entry."
    job_id = match.group(1)

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable is not set for verification."

    client = LlamaCloud(api_key=api_key)
    response = client.parsing.get(job_id=job_id)
    assert response is not None, f"LlamaCloud returned no response for ID {job_id}."

    # client.parsing.get() returns a ParsingGetResponse whose .job field holds
    # the Job object with the status. Fall back to checking the response itself
    # in case the SDK ever flattens the shape.
    job_obj = getattr(response, "job", response)
    status = getattr(job_obj, "status", None)
    status_str = str(status).upper() if status is not None else ""
    assert any(token in status_str for token in ("SUCCESS", "COMPLETED")), (
        f"Parse job {job_id} did not reach a successful terminal state; status={status_str!r}."
    )
