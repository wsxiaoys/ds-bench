import json
import os
import subprocess
import sys

import pytest

PROJECT_DIR = "/home/user/project"
FIXTURE_PDF = os.path.join(PROJECT_DIR, "assets", "report.pdf")
OUT_DIR = os.path.join(PROJECT_DIR, "out")
DOCTAGS_PATH = os.path.join(OUT_DIR, "original.doctags")
RECON_MD_PATH = os.path.join(OUT_DIR, "reconstructed.md")
REPORT_PATH = os.path.join(OUT_DIR, "comparison_report.json")

CATEGORIES = ("texts", "tables", "pictures", "headings")
STRUCTURAL = ("tables", "pictures", "headings")

RUN_TIMEOUT = 900


def _count_categories(doc):
    """Count text items, tables, pictures, and section-header items in a DoclingDocument."""
    from docling_core.types.doc import DocItemLabel

    texts = len(doc.texts)
    tables = len(doc.tables)
    pictures = len(doc.pictures)
    headings = sum(
        1
        for t in doc.texts
        if getattr(t, "label", None) == DocItemLabel.SECTION_HEADER
    )
    return {"texts": texts, "tables": tables, "pictures": pictures, "headings": headings}


def _run_pipeline(input_arg):
    """Run `python main.py <input_arg>` from the project directory."""
    return subprocess.run(
        [sys.executable, "main.py", input_arg],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )


@pytest.fixture(scope="session")
def pipeline_run():
    """Run the pipeline once on the fixture PDF and gather everything the tests need.

    Also computes two independent oracles (heavy, run once):
      * orig_counts  : counts from an independent default Docling conversion of the fixture PDF.
      * recon_counts : counts from independently parsing the agent's DocTags file back into a
                        DoclingDocument (the round-trip reconstruction).
    """
    # Start from a clean slate so we verify the executor's program actually produces the outputs.
    if os.path.isdir(OUT_DIR):
        for name in ("original.doctags", "reconstructed.md", "comparison_report.json"):
            p = os.path.join(OUT_DIR, name)
            if os.path.exists(p):
                os.remove(p)

    proc = _run_pipeline("assets/report.pdf")

    data = {
        "proc": proc,
        "doctags_text": None,
        "md_text": None,
        "report": None,
        "report_error": None,
        "orig_counts": None,
        "recon_counts": None,
        "recon_schema_name": None,
        "recon_error": None,
        "orig_error": None,
    }

    if os.path.isfile(DOCTAGS_PATH):
        with open(DOCTAGS_PATH, "r", encoding="utf-8") as fh:
            data["doctags_text"] = fh.read()
    if os.path.isfile(RECON_MD_PATH):
        with open(RECON_MD_PATH, "r", encoding="utf-8") as fh:
            data["md_text"] = fh.read()
    if os.path.isfile(REPORT_PATH):
        try:
            with open(REPORT_PATH, "r", encoding="utf-8") as fh:
                data["report"] = json.load(fh)
        except Exception as exc:  # noqa: BLE001
            data["report_error"] = str(exc)

    # Independent oracle 1: reconstruct from the agent's DocTags file.
    if data["doctags_text"]:
        try:
            from docling_core.types.doc import DoclingDocument
            from docling_core.types.doc.doctags import DocTagsDocument

            dtd = DocTagsDocument.from_multipage_doctags_and_images(
                data["doctags_text"], None
            )
            recon = DoclingDocument.load_from_doctags(dtd)
            data["recon_schema_name"] = recon.schema_name
            data["recon_counts"] = _count_categories(recon)
        except Exception as exc:  # noqa: BLE001
            data["recon_error"] = repr(exc)

    # Independent oracle 2: default conversion of the fixture PDF.
    try:
        from docling.document_converter import DocumentConverter

        orig = DocumentConverter().convert(FIXTURE_PDF).document
        data["orig_counts"] = _count_categories(orig)
    except Exception as exc:  # noqa: BLE001
        data["orig_error"] = repr(exc)

    return data


def test_pipeline_exit_code(pipeline_run):
    proc = pipeline_run["proc"]
    assert proc.returncode == 0, (
        "Running `python main.py assets/report.pdf` did not exit 0. "
        f"stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )


def test_artifacts_exist_and_non_empty(pipeline_run):
    for path in (DOCTAGS_PATH, RECON_MD_PATH, REPORT_PATH):
        assert os.path.isfile(path), f"Expected artifact {path} to exist after the run."
        assert os.path.getsize(path) > 0, f"Artifact {path} is empty."


def test_doctags_contains_table_and_picture_tags(pipeline_run):
    text = pipeline_run["doctags_text"]
    assert text, f"Could not read DocTags file {DOCTAGS_PATH}."
    assert "<otsl>" in text, (
        "DocTags export must contain the table-structure tag '<otsl>' "
        "(no table was serialized into the DocTags representation)."
    )
    assert "<picture>" in text, (
        "DocTags export must contain the picture tag '<picture>' "
        "(no figure was serialized into the DocTags representation)."
    )


def test_reconstruction_is_valid_docling_document(pipeline_run):
    assert pipeline_run["recon_error"] is None, (
        "Independently parsing out/original.doctags back into a DoclingDocument failed: "
        f"{pipeline_run['recon_error']}"
    )
    assert pipeline_run["recon_schema_name"] == "DoclingDocument", (
        "Reconstructed object is not a valid DoclingDocument "
        f"(schema_name={pipeline_run['recon_schema_name']!r})."
    )


def test_fixture_has_expected_structure(pipeline_run):
    assert pipeline_run["orig_error"] is None, (
        f"Independent default conversion of the fixture PDF failed: {pipeline_run['orig_error']}"
    )
    orig = pipeline_run["orig_counts"]
    assert orig["tables"] >= 1, f"Fixture must yield at least 1 table, got {orig['tables']}."
    assert orig["pictures"] >= 1, f"Fixture must yield at least 1 picture, got {orig['pictures']}."
    assert orig["headings"] >= 2, f"Fixture must yield at least 2 section headers, got {orig['headings']}."


def test_roundtrip_fidelity_independent(pipeline_run):
    """The DocTags round trip must preserve structure: reconstructed counts equal original counts."""
    orig = pipeline_run["orig_counts"]
    recon = pipeline_run["recon_counts"]
    assert orig is not None, "Original oracle counts unavailable."
    assert recon is not None, (
        f"Reconstructed oracle counts unavailable (recon_error={pipeline_run['recon_error']})."
    )
    for cat in CATEGORIES:
        assert recon[cat] == orig[cat], (
            f"Round trip lost fidelity for '{cat}': original={orig[cat]} reconstructed={recon[cat]}."
        )


def test_report_schema(pipeline_run):
    assert pipeline_run["report_error"] is None, (
        f"comparison_report.json is not valid JSON: {pipeline_run['report_error']}"
    )
    report = pipeline_run["report"]
    assert isinstance(report, dict), "comparison_report.json must be a JSON object."
    assert set(report.keys()) == {"original", "reconstructed", "match", "equivalent"}, (
        f"Report top-level keys must be exactly original/reconstructed/match/equivalent, got {sorted(report.keys())}."
    )
    for side in ("original", "reconstructed"):
        section = report[side]
        assert isinstance(section, dict), f"report['{side}'] must be an object."
        assert set(section.keys()) == set(CATEGORIES), (
            f"report['{side}'] keys must be exactly {CATEGORIES}, got {sorted(section.keys())}."
        )
        for cat in CATEGORIES:
            assert isinstance(section[cat], int) and not isinstance(section[cat], bool), (
                f"report['{side}']['{cat}'] must be an integer, got {section[cat]!r}."
            )
    match = report["match"]
    assert isinstance(match, dict) and set(match.keys()) == set(CATEGORIES), (
        f"report['match'] keys must be exactly {CATEGORIES}, got {sorted(match.keys()) if isinstance(match, dict) else match!r}."
    )
    for cat in CATEGORIES:
        assert isinstance(match[cat], bool), f"report['match']['{cat}'] must be a boolean."
    assert isinstance(report["equivalent"], bool), "report['equivalent'] must be a boolean."


def test_report_reconstructed_matches_parsed_file(pipeline_run):
    """Anti-cheat: the reported reconstructed counts must equal an independent parse of the DocTags file."""
    report = pipeline_run["report"]
    recon = pipeline_run["recon_counts"]
    assert report is not None and recon is not None, "Report or reconstruction oracle unavailable."
    for cat in CATEGORIES:
        assert report["reconstructed"][cat] == recon[cat], (
            f"report['reconstructed']['{cat}']={report['reconstructed'][cat]} does not match the "
            f"counts obtained by independently parsing out/original.doctags ({recon[cat]}). "
            "The reconstructed side must be derived from the DocTags file."
        )


def test_report_original_structural_matches_conversion(pipeline_run):
    report = pipeline_run["report"]
    orig = pipeline_run["orig_counts"]
    assert report is not None and orig is not None, "Report or original oracle unavailable."
    for cat in STRUCTURAL:
        assert report["original"][cat] == orig[cat], (
            f"report['original']['{cat}']={report['original'][cat]} does not match the independent "
            f"conversion of the fixture ({orig[cat]})."
        )


def test_report_match_and_equivalence(pipeline_run):
    report = pipeline_run["report"]
    for cat in CATEGORIES:
        expected = report["original"][cat] == report["reconstructed"][cat]
        assert report["match"][cat] is expected, (
            f"report['match']['{cat}'] must be {expected} given "
            f"original={report['original'][cat]} reconstructed={report['reconstructed'][cat]}."
        )
    assert all(report["match"][cat] for cat in CATEGORIES), (
        f"All per-category matches must be true; got {report['match']}."
    )
    assert report["equivalent"] is True, (
        "report['equivalent'] must be true when all categories match (faithful round trip)."
    )


def test_reconstructed_markdown_preserves_content(pipeline_run):
    md = pipeline_run["md_text"]
    assert md, f"Could not read {RECON_MD_PATH}."
    for needle in ("Regional Revenue", "Methodology", "Region", "North"):
        assert needle in md, (
            f"Reconstructed Markdown must preserve the string {needle!r} "
            "(heading/table content lost across the round trip)."
        )


def test_error_on_missing_input_file():
    # Clean any prior artifacts so we can assert the error path writes nothing.
    if os.path.isdir(OUT_DIR):
        for name in ("original.doctags", "reconstructed.md", "comparison_report.json"):
            p = os.path.join(OUT_DIR, name)
            if os.path.exists(p):
                os.remove(p)

    proc = _run_pipeline("assets/does_not_exist_zzz.pdf")
    assert proc.returncode == 2, (
        "Running the pipeline on a non-existent input file must exit with code 2, "
        f"got {proc.returncode}. stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
    assert "Traceback (most recent call last)" not in proc.stderr, (
        f"The program must handle a missing input gracefully without a traceback. stderr={proc.stderr!r}"
    )
    for name in ("original.doctags", "reconstructed.md", "comparison_report.json"):
        assert not os.path.exists(os.path.join(OUT_DIR, name)), (
            f"The error path must not write artifact {name}."
        )


def test_error_on_missing_argument():
    proc = subprocess.run(
        [sys.executable, "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 2, (
        "Running the pipeline with no positional argument must exit with code 2, "
        f"got {proc.returncode}. stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
