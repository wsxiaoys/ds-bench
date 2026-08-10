import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
MAIN = os.path.join(PROJECT_DIR, "main.py")
REPORT_PATH = os.path.join(PROJECT_DIR, "output", "gating_report.json")
MD_PATH = os.path.join(PROJECT_DIR, "output", "repaired.md")

EXPECTED_PAGE_KEYS = {
    "page_no",
    "garble_score",
    "programmatic_char_count",
    "ocr_char_count",
    "text_source",
    "needs_ocr",
}

# Pages of the baked fixture PDF.
CLEAN_PAGES = {1, 2, 4}
OCR_PAGE = 3
THRESHOLD = 0.30

# OCR is slow on CPU; allow a very generous budget for the two-pass pipeline.
RUN_TIMEOUT = 1500


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


@pytest.fixture(scope="session")
def pipeline_run():
    """Run the agent's pipeline exactly once and share outputs across tests."""
    assert os.path.isfile(MAIN), f"Expected entrypoint {MAIN} to exist."

    # Ensure a fresh run: remove any stale outputs.
    for path in (REPORT_PATH, MD_PATH):
        if os.path.exists(path):
            os.remove(path)

    proc = subprocess.run(
        ["python3", "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )
    print("=== main.py stdout ===")
    print(proc.stdout)
    print("=== main.py stderr ===")
    print(proc.stderr)
    assert proc.returncode == 0, (
        f"`python3 main.py` exited with {proc.returncode}. stderr:\n{proc.stderr}"
    )
    return proc


@pytest.fixture(scope="session")
def report(pipeline_run):
    assert os.path.isfile(REPORT_PATH), f"Gating report {REPORT_PATH} was not created."
    with open(REPORT_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data


@pytest.fixture(scope="session")
def markdown(pipeline_run):
    assert os.path.isfile(MD_PATH), f"Repaired markdown {MD_PATH} was not created."
    with open(MD_PATH, encoding="utf-8") as f:
        return f.read()


def _pages_by_no(report):
    return {p["page_no"]: p for p in report["pages"]}


def test_outputs_exist(pipeline_run):
    assert os.path.isfile(REPORT_PATH), f"{REPORT_PATH} does not exist."
    assert os.path.getsize(REPORT_PATH) > 0, f"{REPORT_PATH} is empty."
    assert os.path.isfile(MD_PATH), f"{MD_PATH} does not exist."
    assert os.path.getsize(MD_PATH) > 0, f"{MD_PATH} is empty."


def test_report_top_level_schema(report):
    assert isinstance(report, dict), "gating_report.json must be a JSON object."
    for key in ("source_pdf", "garble_threshold", "page_count", "pages"):
        assert key in report, f"gating_report.json missing top-level key '{key}'."
    assert report["source_pdf"] == "assets/source.pdf", (
        f"Expected source_pdf == 'assets/source.pdf', got {report['source_pdf']!r}."
    )
    assert _is_number(report["garble_threshold"]), "garble_threshold must be numeric."
    assert abs(float(report["garble_threshold"]) - THRESHOLD) < 1e-9, (
        f"Expected garble_threshold == 0.30, got {report['garble_threshold']!r}."
    )
    assert isinstance(report["pages"], list), "pages must be a list."
    assert report["page_count"] == 4, (
        f"Expected page_count == 4, got {report['page_count']!r}."
    )
    assert report["page_count"] == len(report["pages"]), (
        "page_count must equal len(pages)."
    )


def test_pages_schema_and_ordering(report):
    pages = report["pages"]
    assert len(pages) == 4, f"Expected 4 pages, got {len(pages)}."
    page_nos = [p["page_no"] for p in pages]
    assert page_nos == [1, 2, 3, 4], (
        f"pages must be ordered by ascending page_no starting at 1, got {page_nos}."
    )
    for p in pages:
        assert set(p.keys()) == EXPECTED_PAGE_KEYS, (
            f"Page {p.get('page_no')!r} has keys {set(p.keys())}, "
            f"expected exactly {EXPECTED_PAGE_KEYS}."
        )
        assert isinstance(p["page_no"], int) and not isinstance(p["page_no"], bool), (
            "page_no must be an int."
        )
        assert _is_number(p["garble_score"]), "garble_score must be numeric."
        assert isinstance(p["programmatic_char_count"], int) and not isinstance(
            p["programmatic_char_count"], bool
        ), "programmatic_char_count must be an int."
        assert p["ocr_char_count"] is None or (
            isinstance(p["ocr_char_count"], int)
            and not isinstance(p["ocr_char_count"], bool)
        ), "ocr_char_count must be an int or null."
        assert p["text_source"] in ("programmatic", "ocr"), (
            f"text_source must be 'programmatic' or 'ocr', got {p['text_source']!r}."
        )
        assert isinstance(p["needs_ocr"], bool), "needs_ocr must be a boolean."


def test_thresholding_consistency(report):
    for p in report["pages"]:
        score = float(p["garble_score"])
        expected_needs = score >= THRESHOLD
        assert p["needs_ocr"] == expected_needs, (
            f"Page {p['page_no']}: needs_ocr={p['needs_ocr']} but garble_score={score} "
            f"vs threshold {THRESHOLD} implies {expected_needs}."
        )
        assert (p["text_source"] == "ocr") == p["needs_ocr"], (
            f"Page {p['page_no']}: text_source/needs_ocr inconsistent "
            f"({p['text_source']!r} vs {p['needs_ocr']})."
        )
        if p["text_source"] == "programmatic":
            assert p["ocr_char_count"] is None, (
                f"Page {p['page_no']}: programmatic page must have ocr_char_count == null."
            )
        else:
            assert isinstance(p["ocr_char_count"], int) and not isinstance(
                p["ocr_char_count"], bool
            ), f"Page {p['page_no']}: ocr page must have integer ocr_char_count."


def test_clean_pages_are_programmatic(report):
    pages = _pages_by_no(report)
    for no in sorted(CLEAN_PAGES):
        p = pages[no]
        assert p["text_source"] == "programmatic", (
            f"Clean page {no} should use programmatic text, got {p['text_source']!r}."
        )
        assert p["needs_ocr"] is False, f"Clean page {no} should not need OCR."
        assert float(p["garble_score"]) < THRESHOLD, (
            f"Clean page {no} garble_score {p['garble_score']} should be below {THRESHOLD}."
        )
        assert abs(float(p["garble_score"])) < 1e-9, (
            f"Clean page {no} should have garble_score 0.0, got {p['garble_score']}."
        )
        assert p["ocr_char_count"] is None, (
            f"Clean page {no} should have ocr_char_count == null."
        )
        assert p["programmatic_char_count"] > 0, (
            f"Clean page {no} should have programmatic_char_count > 0."
        )


def test_image_page_flagged_for_ocr(report):
    p = _pages_by_no(report)[OCR_PAGE]
    assert p["text_source"] == "ocr", (
        f"Image-only page {OCR_PAGE} must use OCR text, got {p['text_source']!r}."
    )
    assert p["needs_ocr"] is True, f"Image-only page {OCR_PAGE} must be flagged needs_ocr."
    assert float(p["garble_score"]) >= THRESHOLD, (
        f"Image-only page {OCR_PAGE} garble_score {p['garble_score']} must be >= {THRESHOLD}."
    )
    assert isinstance(p["ocr_char_count"], int) and not isinstance(
        p["ocr_char_count"], bool
    ), f"Image-only page {OCR_PAGE} must report an integer ocr_char_count."
    assert p["ocr_char_count"] > 0, (
        f"Image-only page {OCR_PAGE} ocr_char_count must be > 0 (OCR found text)."
    )


def test_exactly_one_ocr_page(report):
    ocr_pages = [p["page_no"] for p in report["pages"] if p["text_source"] == "ocr"]
    assert ocr_pages == [OCR_PAGE], (
        f"Exactly page {OCR_PAGE} should be OCR-repaired, got OCR pages {ocr_pages}."
    )


def test_ocr_only_text_recovered(markdown):
    assert "four hundred dollars" in markdown.lower(), (
        "repaired.md must contain the OCR-only phrase 'four hundred dollars' "
        "recovered from the image-only page."
    )


def test_clean_text_preserved(markdown):
    for sentence in (
        "The quarterly revenue increased by twelve percent.",
        "All figures are reported in United States dollars.",
        "This concludes the annual summary section.",
    ):
        assert sentence in markdown, (
            f"repaired.md must preserve the clean programmatic sentence: {sentence!r}."
        )


def test_page_ordering_preserved(markdown):
    lowered = markdown.lower()
    markers = [
        "twelve percent",
        "united states dollars",
        "four hundred dollars",
        "annual summary section",
    ]
    indices = []
    for m in markers:
        idx = lowered.find(m)
        assert idx != -1, f"Expected marker {m!r} to appear in repaired.md."
        indices.append(idx)
    assert indices == sorted(indices), (
        f"repaired.md content is out of page order; marker offsets={indices}."
    )
