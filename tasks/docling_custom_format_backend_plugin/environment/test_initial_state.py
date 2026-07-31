import importlib
import os
import sys

PROJECT_DIR = "/home/user/project"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")

CLEAN_FILES = ["alpha.rcp", "bravo.rcp", "readme.md"]
MIXED_FILES = [
    "alpha.rcp",
    "bravo.rcp",
    "broken.rcp",
    "readme.md",
    "notes.txt",
    "inventory.csv",
]
MALFORMED_FILES = [
    "bad_magic.rcp",
    "dup_key.rcp",
    "missing_title.rcp",
    "no_terminator.rcp",
    "ragged_table.rcp",
    "unknown_marker.rcp",
]


def test_python_version_supported():
    assert sys.version_info >= (3, 10), (
        f"Python 3.10+ is required by Docling, found {sys.version_info}."
    )


def test_docling_importable():
    module = importlib.import_module("docling")
    assert module is not None, "The 'docling' package could not be imported."


def test_docling_core_importable():
    module = importlib.import_module("docling_core")
    assert module is not None, "The 'docling_core' package could not be imported."


def test_document_converter_importable():
    module = importlib.import_module("docling.document_converter")
    assert hasattr(module, "DocumentConverter"), (
        "docling.document_converter.DocumentConverter is not available."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_corpus_directories_exist():
    for name in ["clean", "mixed", "malformed", "unsupported"]:
        path = os.path.join(CORPUS_DIR, name)
        assert os.path.isdir(path), f"Corpus directory {path} does not exist."


def test_clean_corpus_files_exist():
    for name in CLEAN_FILES:
        path = os.path.join(CORPUS_DIR, "clean", name)
        assert os.path.isfile(path), f"Corpus file {path} does not exist."


def test_mixed_corpus_files_exist():
    for name in MIXED_FILES:
        path = os.path.join(CORPUS_DIR, "mixed", name)
        assert os.path.isfile(path), f"Corpus file {path} does not exist."
    nested = os.path.join(CORPUS_DIR, "mixed", "nested", "deep.rcp")
    assert os.path.isfile(nested), f"Corpus file {nested} does not exist."


def test_malformed_corpus_files_exist():
    for name in MALFORMED_FILES:
        path = os.path.join(CORPUS_DIR, "malformed", name)
        assert os.path.isfile(path), f"Corpus file {path} does not exist."


def test_unsupported_corpus_file_exists():
    path = os.path.join(CORPUS_DIR, "unsupported", "inventory.csv")
    assert os.path.isfile(path), f"Corpus file {path} does not exist."


def test_alpha_fixture_follows_rcp_grammar():
    path = os.path.join(CORPUS_DIR, "clean", "alpha.rcp")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    lines = content.split("\n")
    assert lines[0] == "%RCP/1.0", (
        f"{path} must start with the RCP magic line, found {lines[0]!r}."
    )
    assert "id=alpha-run" in lines, f"{path} is missing the 'id' header entry."
    assert "title=Cold Brew Concentrate" in lines, (
        f"{path} is missing the 'title' header entry."
    )
    assert "%%" in lines, f"{path} is missing the '%%' header terminator."
    for marker in ["S1> ", "P> ", "N> ", "B> ", "A> ", "F> ", "| "]:
        assert any(line.startswith(marker) for line in lines), (
            f"{path} does not contain any body line starting with {marker!r}."
        )


def test_artifacts_path_env_points_to_existing_model_cache():
    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    assert artifacts_path, "DOCLING_ARTIFACTS_PATH is not set in the environment."
    assert os.path.isdir(artifacts_path), (
        f"DOCLING_ARTIFACTS_PATH points to {artifacts_path}, which is not a directory."
    )
