import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
PAGE_1_FILE = os.path.join(OUTPUT_DIR, "page_1.md")
PAGE_2_FILE = os.path.join(OUTPUT_DIR, "page_2.md")

JOB_ID_RE = re.compile(r"^Job ID:\s*(pjb-[A-Za-z0-9_-]+)\s*$", re.MULTILINE)
PAGES_RE = re.compile(r"^Pages parsed:\s*(\d+)\s*$", re.MULTILINE)


def _read_log():
    assert os.path.isfile(LOG_FILE), f"Expected log file at {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as fp:
        return fp.read()


def _extract_job_id(log_text):
    match = JOB_ID_RE.search(log_text)
    assert match, (
        f"Log file {LOG_FILE} does not contain a line matching "
        "'Job ID: pjb-<id>'. Content was:\n" + log_text
    )
    return match.group(1)


def test_log_file_contains_job_id_line():
    log_text = _read_log()
    _extract_job_id(log_text)


def test_log_file_contains_pages_parsed_line():
    log_text = _read_log()
    match = PAGES_RE.search(log_text)
    assert match, (
        f"Log file {LOG_FILE} does not contain a line matching "
        "'Pages parsed: <count>'."
    )
    count = int(match.group(1))
    assert count == 2, f"Expected 'Pages parsed: 2' in {LOG_FILE}, got {count}."


def test_page_1_markdown_exists_and_non_empty():
    assert os.path.isfile(PAGE_1_FILE), f"{PAGE_1_FILE} does not exist."
    assert os.path.getsize(PAGE_1_FILE) > 0, f"{PAGE_1_FILE} is empty."


def test_page_2_markdown_exists_and_non_empty():
    assert os.path.isfile(PAGE_2_FILE), f"{PAGE_2_FILE} does not exist."
    assert os.path.getsize(PAGE_2_FILE) > 0, f"{PAGE_2_FILE} is empty."


def test_output_dir_contains_only_expected_files():
    assert os.path.isdir(OUTPUT_DIR), f"{OUTPUT_DIR} does not exist."
    entries = sorted(os.listdir(OUTPUT_DIR))
    assert entries == ["page_1.md", "page_2.md"], (
        f"Expected only ['page_1.md', 'page_2.md'] in {OUTPUT_DIR}, got {entries}."
    )


def test_parse_job_state_via_sdk():
    """Use the LlamaCloud Python SDK to verify the parse job ran with the expected
    configuration and that the on-disk per-page Markdown matches what the API returned."""
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY is not set in the verifier environment."

    from llama_cloud import LlamaCloud

    log_text = _read_log()
    job_id = _extract_job_id(log_text)

    client = LlamaCloud(api_key=api_key)
    result = client.parsing.get(
        job_id=job_id,
        expand=["markdown", "job_metadata"],
    )

    # 1) Job status: any terminal-success-ish status is acceptable.
    job = getattr(result, "job", None)
    assert job is not None, "Parse job payload missing on `result.job`."
    status = str(getattr(job, "status", "")).upper()
    assert status in {"SUCCESS", "COMPLETED", "FINISHED"}, (
        f"Parse job {job_id} did not finish successfully. Status was: {status!r}."
    )

    # 2) Exactly 2 pages returned by the API.
    md = getattr(result, "markdown", None)
    assert md is not None and hasattr(md, "pages"), (
        "`result.markdown.pages` is missing on the parse result."
    )
    pages = list(md.pages)
    assert len(pages) == 2, (
        f"Expected the parse job to return exactly 2 pages, got {len(pages)}."
    )

    # 3) Tier check: the job must have been submitted with the cost_effective tier.
    def _read_tier():
        # Tier may be exposed on either `result.job.tier` or via job_metadata.
        candidates = []
        if job is not None:
            candidates.append(getattr(job, "tier", None))
        jm = getattr(result, "job_metadata", None)
        if jm is not None:
            candidates.append(getattr(jm, "tier", None))
            # Sometimes nested as configuration.tier
            cfg = getattr(jm, "configuration", None)
            if cfg is not None:
                candidates.append(getattr(cfg, "tier", None))
        # Also try dict-like access in case the SDK returns a TypedDict
        for source in (job, getattr(result, "job_metadata", None)):
            if isinstance(source, dict):
                candidates.append(source.get("tier"))
                cfg = source.get("configuration")
                if isinstance(cfg, dict):
                    candidates.append(cfg.get("tier"))
        for tier_val in candidates:
            if tier_val:
                return str(tier_val).lower()
        return None

    tier_value = _read_tier()
    assert tier_value is not None, (
        "Could not locate the tier value on the parse job payload — expected "
        "`result.job.tier` or `result.job_metadata.tier` to be set."
    )
    assert "cost_effective" in tier_value or "cost-effective" in tier_value, (
        f"Parse job {job_id} was submitted with tier={tier_value!r}, "
        "expected 'cost_effective'."
    )

    # 4) The on-disk per-page Markdown files must match what the API returned.
    by_number = {}
    for page in pages:
        number = getattr(page, "page_number", None)
        markdown_text = getattr(page, "markdown", None)
        assert number is not None and markdown_text is not None, (
            "Each entry in result.markdown.pages must expose page_number and markdown."
        )
        by_number[int(number)] = str(markdown_text)

    assert set(by_number.keys()) == {1, 2}, (
        f"Expected the parse job to return pages numbered {{1, 2}}, got "
        f"{set(by_number.keys())}."
    )

    for page_number, expected_md in by_number.items():
        path = os.path.join(OUTPUT_DIR, f"page_{page_number}.md")
        with open(path, "r", encoding="utf-8") as fp:
            on_disk = fp.read()
        # Normalize trailing newline differences only.
        assert on_disk.rstrip("\n") == expected_md.rstrip("\n"), (
            f"Markdown content of {path} does not match the API response for "
            f"page {page_number}."
        )
