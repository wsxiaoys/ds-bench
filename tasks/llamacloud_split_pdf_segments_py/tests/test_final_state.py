import json
import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
PDF_PATH = os.path.join(PROJECT_DIR, "data", "turing+imagenet+attention.pdf")
CONFIG_PATH = os.path.join(PROJECT_DIR, "data", "categories.json")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "segments.json")
EXPECTED_PAGE_COUNT = 24


def _run_cli(args, cwd=PROJECT_DIR, timeout=600):
    return subprocess.run(
        ["python3", "run.py", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def test_cli_rejects_missing_arguments():
    """Invoking the CLI without arguments must fail loudly."""
    if os.path.exists(OUTPUT_PATH):
        os.remove(OUTPUT_PATH)
    result = _run_cli([], timeout=60)
    assert result.returncode != 0, (
        "Running `python3 run.py` with no arguments must exit with non-zero status, "
        f"but got 0. stdout={result.stdout!r}, stderr={result.stderr!r}"
    )


def test_cli_run_produces_output_file():
    """End-to-end run on the bundled fixtures must succeed and write segments.json."""
    if os.path.exists(OUTPUT_PATH):
        os.remove(OUTPUT_PATH)
    result = _run_cli(
        [
            "--pdf", PDF_PATH,
            "--config", CONFIG_PATH,
            "--output", OUTPUT_PATH,
        ],
        timeout=900,
    )
    assert result.returncode == 0, (
        "CLI run failed. "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )
    assert os.path.isfile(OUTPUT_PATH), (
        f"Expected output file {OUTPUT_PATH} to be created."
    )


def _load_segments():
    assert os.path.isfile(OUTPUT_PATH), (
        f"Output file {OUTPUT_PATH} is missing. Did the CLI run succeed?"
    )
    with open(OUTPUT_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    assert isinstance(data, dict), "Output JSON must be a top-level object."
    assert "segments" in data, "Output JSON must contain a 'segments' key."
    segments = data["segments"]
    assert isinstance(segments, list) and len(segments) > 0, (
        "'segments' must be a non-empty list."
    )
    return segments


def test_segment_schema():
    """Each segment must expose category, pages and confidence_category fields."""
    segments = _load_segments()
    allowed_confidences = {"high", "medium", "low"}
    for idx, segment in enumerate(segments):
        assert isinstance(segment, dict), f"Segment {idx} must be a JSON object."
        assert isinstance(segment.get("category"), str) and segment["category"], (
            f"Segment {idx} must have a non-empty string 'category'."
        )
        pages = segment.get("pages")
        assert isinstance(pages, list) and len(pages) > 0, (
            f"Segment {idx} must have a non-empty 'pages' list."
        )
        for page in pages:
            assert isinstance(page, int) and page >= 1, (
                f"Segment {idx} has invalid page number {page!r}; "
                "pages must be 1-based integers."
            )
        assert segment.get("confidence_category") in allowed_confidences, (
            f"Segment {idx} must have 'confidence_category' in {allowed_confidences}, "
            f"got {segment.get('confidence_category')!r}."
        )


def test_category_coverage():
    """Both 'essay' and 'research_paper' must appear in the segment categories."""
    segments = _load_segments()
    categories = {segment["category"] for segment in segments}
    assert "essay" in categories, (
        f"Expected at least one segment with category 'essay'. Got categories={categories}."
    )
    assert "research_paper" in categories, (
        f"Expected at least one segment with category 'research_paper'. Got categories={categories}."
    )


def test_pages_cover_full_document_without_duplicates():
    """The union of all segment page numbers must equal the full 1..24 PDF range."""
    segments = _load_segments()
    all_pages = []
    for segment in segments:
        all_pages.extend(segment["pages"])
    assert len(all_pages) == len(set(all_pages)), (
        f"Pages should not be duplicated across segments. Got pages={all_pages}."
    )
    assert set(all_pages) == set(range(1, EXPECTED_PAGE_COUNT + 1)), (
        f"Page coverage mismatch. Expected pages 1-{EXPECTED_PAGE_COUNT}, got {sorted(set(all_pages))}."
    )


def test_segments_ordered_by_pages():
    """Segments must appear in ascending page order with no overlaps."""
    segments = _load_segments()
    last_max = 0
    for idx, segment in enumerate(segments):
        pages = segment["pages"]
        seg_min = min(pages)
        seg_max = max(pages)
        assert seg_min > last_max, (
            f"Segment {idx} starts at page {seg_min} but previous segment ended at {last_max}; "
            "segments must be ordered with no page overlap."
        )
        last_max = seg_max
