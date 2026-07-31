import importlib
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/fixpoint"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")

ELIGIBLE_FILES = [
    "alignment_table.md",
    "fenced_code.md",
    "fragment_page.html",
    "nested_lists.md",
    "quotes_media.md",
    "ragged_whitespace.md",
    "unicode_emoji.md",
]


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 was not found in PATH."


def test_docling_importable():
    module = importlib.import_module("docling")
    assert module is not None, "The docling package could not be imported."


def test_docling_core_importable():
    module = importlib.import_module("docling_core")
    assert module is not None, "The docling_core package could not be imported."


def test_docling_distribution_is_installed():
    from importlib.metadata import PackageNotFoundError, version

    resolved = None
    for distribution in ("docling", "docling-slim"):
        try:
            resolved = version(distribution)
            break
        except PackageNotFoundError:
            continue
    assert resolved is not None, (
        "Neither the 'docling' nor the 'docling-slim' distribution is installed."
    )
    major, minor = (int(part) for part in resolved.split(".")[:2])
    assert (major, minor) >= (2, 107), (
        f"Expected docling 2.107.0 or newer, found {resolved}."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_directory_is_writable():
    assert os.access(PROJECT_DIR, os.W_OK), f"Project directory {PROJECT_DIR} is not writable."


def test_corpus_directory_exists():
    assert os.path.isdir(CORPUS_DIR), f"Corpus directory {CORPUS_DIR} does not exist."


def test_all_eligible_corpus_files_exist_and_are_not_empty():
    for name in ELIGIBLE_FILES:
        path = os.path.join(CORPUS_DIR, name)
        assert os.path.isfile(path), f"Corpus source file {path} does not exist."
        assert os.path.getsize(path) > 0, f"Corpus source file {path} is empty."


def test_corpus_contains_no_unexpected_eligible_files():
    found = sorted(
        entry
        for entry in os.listdir(CORPUS_DIR)
        if os.path.isfile(os.path.join(CORPUS_DIR, entry))
        and os.path.splitext(entry)[1].lower() in (".md", ".html")
    )
    assert found == sorted(ELIGIBLE_FILES), (
        f"Unexpected set of eligible corpus files: {found}"
    )


def test_corpus_contains_ignorable_entries():
    txt_path = os.path.join(CORPUS_DIR, "README.txt")
    assert os.path.isfile(txt_path), f"Expected the ignorable file {txt_path} to exist."
    notes_dir = os.path.join(CORPUS_DIR, "notes")
    assert os.path.isdir(notes_dir), f"Expected the ignorable directory {notes_dir} to exist."
    nested = os.path.join(notes_dir, "ignored.md")
    assert os.path.isfile(nested), f"Expected the nested file {nested} to exist."


def test_unicode_fixture_contains_non_ascii():
    path = os.path.join(CORPUS_DIR, "unicode_emoji.md")
    with open(path, "rb") as handle:
        raw = handle.read()
    assert any(byte > 127 for byte in raw), (
        f"{path} was expected to contain non-ASCII characters."
    )


def test_whitespace_fixture_contains_pathological_whitespace():
    path = os.path.join(CORPUS_DIR, "ragged_whitespace.md")
    with open(path, "rb") as handle:
        raw = handle.read()
    assert b"\r\n" in raw, f"{path} was expected to contain CRLF line endings."
    assert b"\t" in raw, f"{path} was expected to contain TAB characters."


def test_table_fixture_contains_alignment_row():
    path = os.path.join(CORPUS_DIR, "alignment_table.md")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    assert ":---" in content or "---:" in content, (
        f"{path} was expected to contain a markdown table alignment row."
    )


def test_html_fixture_contains_table_markup():
    path = os.path.join(CORPUS_DIR, "fragment_page.html")
    with open(path, encoding="utf-8") as handle:
        content = handle.read().lower()
    assert "<table" in content, f"{path} was expected to contain a <table> element."


def test_solution_entrypoint_not_present_yet():
    audit_path = os.path.join(PROJECT_DIR, "audit.py")
    assert not os.path.exists(audit_path), (
        f"{audit_path} already exists; the auditor must be written by the executor."
    )


def test_output_directory_not_present_yet():
    out_path = os.path.join(PROJECT_DIR, "out")
    assert not os.path.exists(out_path), (
        f"{out_path} already exists; audit output must be produced by the executor."
    )


def test_offline_environment_has_docling_artifacts_path():
    artifacts = os.environ.get("DOCLING_ARTIFACTS_PATH", "")
    assert artifacts, "DOCLING_ARTIFACTS_PATH is not set in the environment."
    assert os.path.isdir(artifacts), (
        f"DOCLING_ARTIFACTS_PATH points to {artifacts!r}, which is not a directory."
    )


def test_docling_cli_is_available():
    executable = shutil.which("docling")
    assert executable is not None, "The docling CLI was not found in PATH."
    result = subprocess.run(
        [executable, "--version"],
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert result.returncode == 0, (
        f"`docling --version` failed with exit code {result.returncode}: {result.stderr}"
    )
