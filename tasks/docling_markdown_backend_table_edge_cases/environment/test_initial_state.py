import os

PROJECT_DIR = "/home/user/md_table_audit"
CORPUS_DIR = os.path.join(PROJECT_DIR, "assets", "corpus")

EXPECTED_CORPUS_FILES = [
    "01_alignments.md",
    "02_formatted_headers.md",
    "03_ragged_cells.md",
    "04_pipes_in_prose.md",
    "05_code_and_images.md",
    "06_broken_encoding.md",
]


def test_docling_is_importable():
    try:
        import docling  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        raise AssertionError(f"docling is not importable in the environment: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_corpus_directory_exists():
    assert os.path.isdir(CORPUS_DIR), f"Corpus directory {CORPUS_DIR} does not exist."


def test_corpus_contains_expected_documents():
    actual = sorted(name for name in os.listdir(CORPUS_DIR) if name.endswith(".md"))
    assert actual == EXPECTED_CORPUS_FILES, (
        f"Corpus {CORPUS_DIR} should contain exactly {EXPECTED_CORPUS_FILES}, found {actual}."
    )


def test_broken_document_is_not_valid_utf8():
    path = os.path.join(CORPUS_DIR, "06_broken_encoding.md")
    with open(path, "rb") as handle:
        payload = handle.read()
    try:
        payload.decode("utf-8")
    except UnicodeDecodeError:
        return
    raise AssertionError(f"{path} is expected to contain invalid UTF-8 bytes.")


def test_image_document_contains_embedded_data_uris():
    path = os.path.join(CORPUS_DIR, "05_code_and_images.md")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    count = content.count("data:image/png;base64,")
    assert count == 3, f"{path} should embed exactly 3 base64 PNG data URIs, found {count}."


def test_ragged_document_contains_escaped_pipe():
    path = os.path.join(CORPUS_DIR, "03_ragged_cells.md")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    assert "\\|" in content, f"{path} should contain an escaped pipe sequence."
