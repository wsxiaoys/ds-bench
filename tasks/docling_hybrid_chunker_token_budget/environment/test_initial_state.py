import importlib.util
import json
import os
import shutil

PROJECT_DIR = "/home/user/chunkforge"
CORPUS_DIR = os.path.join(PROJECT_DIR, "assets", "corpus")
TOKENIZER_DIR = os.path.join(PROJECT_DIR, "assets", "tokenizer")

EXPECTED_SOURCES = [
    "alpha_guide.md",
    "appendix/omega_notes.md",
    "beta_report.html",
    "delta_brief.pdf",
    "gamma_minutes.docx",
]


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 was not found in PATH."


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, (
        "The 'docling' package is not importable in the environment."
    )


def test_transformers_importable():
    assert importlib.util.find_spec("transformers") is not None, (
        "The 'transformers' package is not importable in the environment."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_corpus_directory_exists():
    assert os.path.isdir(CORPUS_DIR), f"Corpus directory {CORPUS_DIR} does not exist."


def test_all_corpus_documents_present():
    for rel in EXPECTED_SOURCES:
        path = os.path.join(CORPUS_DIR, rel)
        assert os.path.isfile(path), f"Expected corpus document {path} is missing."
        assert os.path.getsize(path) > 0, f"Corpus document {path} is empty."


def test_unsupported_corpus_file_present():
    path = os.path.join(CORPUS_DIR, "notes.txt")
    assert os.path.isfile(path), (
        f"Expected the unsupported-extension file {path} to be part of the corpus."
    )


def test_alpha_guide_contains_oversized_paragraph_markers():
    path = os.path.join(CORPUS_DIR, "alpha_guide.md")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    for marker in ("ZQXSENTINELALPHA", "ZQXSENTINELMIDDLE", "ZQXSENTINELOMEGA"):
        assert marker in content, f"Marker {marker} is missing from {path}."


def test_beta_report_contains_table_values():
    path = os.path.join(CORPUS_DIR, "beta_report.html")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    for token in ("Region", "Zurich", "18420"):
        assert token in content, f"Expected table value {token!r} in {path}."


def test_delta_brief_is_a_pdf():
    path = os.path.join(CORPUS_DIR, "delta_brief.pdf")
    with open(path, "rb") as handle:
        header = handle.read(5)
    assert header == b"%PDF-", f"{path} does not look like a PDF file."


def test_tokenizer_directory_is_usable_offline():
    assert os.path.isdir(TOKENIZER_DIR), f"Tokenizer directory {TOKENIZER_DIR} does not exist."
    config_path = os.path.join(TOKENIZER_DIR, "tokenizer_config.json")
    assert os.path.isfile(config_path), f"Missing tokenizer config at {config_path}."
    with open(config_path, encoding="utf-8") as handle:
        json.load(handle)

    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_DIR)
    tokens = tokenizer.tokenize("docling token budget chunking")
    assert len(tokens) > 0, "The baked-in tokenizer produced no tokens for a sample text."


def test_docling_model_artifacts_are_baked_in():
    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH", "")
    assert artifacts_path, "DOCLING_ARTIFACTS_PATH is not set in the environment."
    assert os.path.isdir(artifacts_path), (
        f"Docling artifacts directory {artifacts_path} does not exist; "
        "model weights must be pre-baked for offline execution."
    )
    assert os.listdir(artifacts_path), f"Docling artifacts directory {artifacts_path} is empty."
