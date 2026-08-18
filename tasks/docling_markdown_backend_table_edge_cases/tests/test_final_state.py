import base64
import json
import os
import re
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/md_table_audit"
CORPUS_DIR = os.path.join(PROJECT_DIR, "assets", "corpus")
OUT_DIR = os.path.join(PROJECT_DIR, "out")

REPORT_512 = os.path.join(OUT_DIR, "verify_512.json")
REPORT_BIG = os.path.join(OUT_DIR, "verify_big.json")
REPORT_TINY = os.path.join(OUT_DIR, "verify_tiny.json")
REPORT_EXTRA = os.path.join(OUT_DIR, "verify_extra.json")

EXTRA_CORPUS_DIR = "/tmp/extra_corpus"
EXTRA_DOCUMENT = (
    "#### Extra Checks\n"
    "\n"
    "Item | **Qty** | [Price](https://example.com/p)\n"
    ":---: | ---: | ---\n"
    "widget \\| pro | 3\n"
    "gizmo | 4 | 9.99 | 12\n"
    "\n"
    "Totals | are | below\n"
)

RUN_TIMEOUT = 900


def _run_audit(corpus, out_path, max_image_bytes):
    result = subprocess.run(
        [
            "python",
            "main.py",
            "--corpus",
            corpus,
            "--out",
            out_path,
            "--max-image-bytes",
            str(max_image_bytes),
        ],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=RUN_TIMEOUT,
    )
    assert result.returncode == 0, (
        "Running 'python main.py --corpus {} --out {} --max-image-bytes {}' in {} "
        "failed with exit code {}.\nstdout:\n{}\nstderr:\n{}".format(
            corpus,
            out_path,
            max_image_bytes,
            PROJECT_DIR,
            result.returncode,
            result.stdout,
            result.stderr,
        )
    )
    assert os.path.isfile(out_path), f"The audit did not create the report file {out_path}."
    with open(out_path, encoding="utf-8") as handle:
        try:
            return json.load(handle)
        except json.JSONDecodeError as exc:
            raise AssertionError(f"{out_path} is not valid JSON: {exc}")


def _document(report, name):
    documents = report.get("documents")
    assert isinstance(documents, list), "The report must contain a 'documents' list."
    matches = [doc for doc in documents if doc.get("name") == name]
    assert len(matches) == 1, (
        f"Expected exactly one document named {name!r} in the report, "
        f"found {[doc.get('name') for doc in documents]}."
    )
    return matches[0]


@pytest.fixture(scope="session", autouse=True)
def clean_artifacts():
    for path in (REPORT_512, REPORT_BIG, REPORT_TINY, REPORT_EXTRA):
        if os.path.exists(path):
            os.remove(path)
    if os.path.isdir(EXTRA_CORPUS_DIR):
        shutil.rmtree(EXTRA_CORPUS_DIR)
    yield


@pytest.fixture(scope="session")
def report_512(clean_artifacts):
    return _run_audit(os.path.join("assets", "corpus"), REPORT_512, 512)


@pytest.fixture(scope="session")
def report_big(clean_artifacts):
    return _run_audit(os.path.join("assets", "corpus"), REPORT_BIG, 100000)


@pytest.fixture(scope="session")
def report_tiny(clean_artifacts):
    return _run_audit(os.path.join("assets", "corpus"), REPORT_TINY, 10)


@pytest.fixture(scope="session")
def report_extra(clean_artifacts):
    os.makedirs(EXTRA_CORPUS_DIR, exist_ok=True)
    with open(os.path.join(EXTRA_CORPUS_DIR, "90_extra.md"), "w", encoding="utf-8") as handle:
        handle.write(EXTRA_DOCUMENT)
    return _run_audit(EXTRA_CORPUS_DIR, REPORT_EXTRA, 512)


def test_report_header(report_512):
    assert report_512.get("schema_version") == "1.0", (
        f"Expected schema_version '1.0', got {report_512.get('schema_version')!r}."
    )
    assert report_512.get("max_image_bytes") == 512, (
        "The report must echo the --max-image-bytes value 512, got "
        f"{report_512.get('max_image_bytes')!r}."
    )


def test_corpus_coverage_and_failed_document(report_512):
    names = [doc.get("name") for doc in report_512["documents"]]
    assert names == [
        "01_alignments",
        "02_formatted_headers",
        "03_ragged_cells",
        "04_pipes_in_prose",
        "05_code_and_images",
    ], f"Unexpected documents (must be name-sorted and exclude the undecodable file): {names}."
    assert report_512.get("failed") == [
        {"name": "06_broken_encoding", "reason": "decode_error"}
    ], f"Unexpected 'failed' section: {report_512.get('failed')!r}."


def test_totals(report_512):
    assert report_512.get("totals") == {
        "documents": 5,
        "failed": 1,
        "tables": 8,
        "table_cells": 50,
        "code_blocks": 3,
        "images": 3,
        "images_decoded": 2,
    }, f"Unexpected totals: {report_512.get('totals')!r}."


def test_pipeless_tables_with_alignment_markers(report_512):
    doc = _document(report_512, "01_alignments")
    tables = doc.get("tables")
    assert isinstance(tables, list) and len(tables) == 2, (
        f"01_alignments must report exactly 2 tables, got {tables!r}."
    )

    first, second = tables
    assert first.get("self_ref") == "#/tables/0", (
        f"Expected self_ref '#/tables/0', got {first.get('self_ref')!r}."
    )
    assert (first.get("num_rows"), first.get("num_cols")) == (3, 3), (
        f"Expected a 3x3 table, got {first.get('num_rows')}x{first.get('num_cols')}."
    )
    assert first.get("cell_count") == 9 and first.get("docling_cell_count") == 9, (
        "Expected cell_count and docling_cell_count of 9, got "
        f"{first.get('cell_count')!r} and {first.get('docling_cell_count')!r}."
    )
    assert first.get("alignments") == ["left", "center", "right"], (
        f"Unexpected alignments for the first table: {first.get('alignments')!r}."
    )
    assert first.get("grid") == [
        ["Region", "Q1", "Q2"],
        ["North", "10", "20"],
        ["South", "30", "40"],
    ], f"Unexpected grid for the first table: {first.get('grid')!r}."

    assert second.get("self_ref") == "#/tables/1", (
        f"Expected self_ref '#/tables/1', got {second.get('self_ref')!r}."
    )
    assert (second.get("num_rows"), second.get("num_cols")) == (3, 2), (
        f"Expected a 3x2 table, got {second.get('num_rows')}x{second.get('num_cols')}."
    )
    assert second.get("cell_count") == 6 and second.get("docling_cell_count") == 6, (
        "Expected cell_count and docling_cell_count of 6, got "
        f"{second.get('cell_count')!r} and {second.get('docling_cell_count')!r}."
    )
    assert second.get("alignments") == ["right", "left"], (
        f"Unexpected alignments for the second table: {second.get('alignments')!r}."
    )
    assert second.get("grid") == [
        ["City", "Growth"],
        ["Zurich", "4.5"],
        ["Basel", "1.25"],
    ], f"Unexpected grid for the second table: {second.get('grid')!r}."

    assert doc.get("pipe_prose") == [], f"Unexpected pipe_prose: {doc.get('pipe_prose')!r}."
    assert doc.get("code_blocks") == [], f"Unexpected code_blocks: {doc.get('code_blocks')!r}."
    assert doc.get("images") == [], f"Unexpected images: {doc.get('images')!r}."
    assert doc.get("image_size_warnings") == 0, (
        f"Unexpected image_size_warnings: {doc.get('image_size_warnings')!r}."
    )


def test_formatted_header_cells(report_512):
    doc = _document(report_512, "02_formatted_headers")
    tables = doc.get("tables")
    assert isinstance(tables, list) and len(tables) == 2, (
        f"02_formatted_headers must report exactly 2 tables, got {tables!r}."
    )
    for table in tables:
        assert (table.get("num_rows"), table.get("num_cols")) == (2, 2), (
            f"Every table of 02_formatted_headers must be 2x2, got {table!r}."
        )
        assert table.get("alignments") == ["none", "none"], (
            f"Unexpected alignments: {table.get('alignments')!r}."
        )
        assert table.get("docling_cell_count") == 4, (
            f"Expected docling_cell_count 4, got {table.get('docling_cell_count')!r}."
        )
    assert tables[0].get("grid") == [["Region", "Q1"], ["North", "10"]], (
        f"Unexpected grid for the bold-header table: {tables[0].get('grid')!r}."
    )
    assert tables[1].get("grid") == [["Region", "Q2"], ["South", "20"]], (
        f"Unexpected grid for the link/code-header table: {tables[1].get('grid')!r}."
    )
    assert doc.get("code_blocks") == [], (
        "An inline code span inside a header cell is not a fenced code block, got "
        f"{doc.get('code_blocks')!r}."
    )
    assert doc.get("pipe_prose") == [], f"Unexpected pipe_prose: {doc.get('pipe_prose')!r}."


def test_ragged_rows_and_escaped_pipes(report_512):
    doc = _document(report_512, "03_ragged_cells")
    tables = doc.get("tables")
    assert isinstance(tables, list) and len(tables) == 1, (
        f"03_ragged_cells must report exactly 1 table, got {tables!r}."
    )
    table = tables[0]
    assert (table.get("num_rows"), table.get("num_cols")) == (5, 3), (
        f"Expected a 5x3 table, got {table.get('num_rows')}x{table.get('num_cols')}."
    )
    assert table.get("cell_count") == 15 and table.get("docling_cell_count") == 15, (
        "Expected cell_count and docling_cell_count of 15, got "
        f"{table.get('cell_count')!r} and {table.get('docling_cell_count')!r}."
    )
    assert table.get("alignments") == ["left", "none", "right"], (
        f"Unexpected alignments: {table.get('alignments')!r}."
    )
    assert table.get("grid") == [
        ["a", "b", "c"],
        ["1", "2", ""],
        ["4", "5", "6"],
        ["", "", ""],
        ["x | y", "z", ""],
    ], f"Unexpected normalized grid: {table.get('grid')!r}."


def test_pipes_in_prose_do_not_become_tables(report_512):
    doc = _document(report_512, "04_pipes_in_prose")
    tables = doc.get("tables")
    assert isinstance(tables, list) and len(tables) == 2, (
        f"04_pipes_in_prose must report exactly 2 tables, got {tables!r}."
    )
    assert tables[0].get("grid") == [["Region", "Q1"], ["North", "10"]], (
        f"Unexpected grid for the first table: {tables[0].get('grid')!r}."
    )
    assert tables[1].get("grid") == [["Region", "Q2"], ["South", "20"]], (
        f"Unexpected grid for the second table: {tables[1].get('grid')!r}."
    )
    assert doc.get("pipe_prose") == [
        "Some sentence with a | pipe in it.",
        "Region | Q1 | Q2",
        "--- | ---",
        "South | 20",
    ], f"Unexpected pipe_prose: {doc.get('pipe_prose')!r}."


def test_code_block_language_detection(report_512):
    doc = _document(report_512, "05_code_and_images")
    assert doc.get("code_blocks") == [
        {"index": 0, "language": "Python", "chars": 26},
        {"index": 1, "language": "SQL", "chars": 21},
        {"index": 2, "language": "unknown", "chars": 22},
    ], f"Unexpected code_blocks: {doc.get('code_blocks')!r}."
    assert doc.get("pipe_prose") == ["Pipeline: extract | transform | load"], (
        f"Unexpected pipe_prose: {doc.get('pipe_prose')!r}."
    )
    tables = doc.get("tables")
    assert isinstance(tables, list) and len(tables) == 1, (
        f"05_code_and_images must report exactly 1 table, got {tables!r}."
    )
    assert tables[0].get("grid") == [["step", "owner"], ["parse", "docling"]], (
        f"Unexpected grid: {tables[0].get('grid')!r}."
    )


def _corpus_image_sizes():
    path = os.path.join(CORPUS_DIR, "05_code_and_images.md")
    with open(path, encoding="utf-8") as handle:
        content = handle.read()
    payloads = re.findall(r"data:image/png;base64,([A-Za-z0-9+/=]+)", content)
    assert len(payloads) == 3, f"Expected 3 embedded PNG data URIs in {path}, found {len(payloads)}."
    return [len(base64.b64decode(payload)) for payload in payloads]


def test_embedded_images_with_cap_512(report_512):
    doc = _document(report_512, "05_code_and_images")
    images = doc.get("images")
    assert isinstance(images, list) and len(images) == 3, (
        f"05_code_and_images must report exactly 3 images, got {images!r}."
    )
    expected_sizes = _corpus_image_sizes()
    assert [img.get("data_bytes") for img in images] == expected_sizes, (
        "Reported data_bytes must equal the decoded sizes of the embedded payloads "
        f"{expected_sizes}, got {[img.get('data_bytes') for img in images]}."
    )
    assert expected_sizes[0] <= 512 and expected_sizes[1] <= 512 and expected_sizes[2] > 512, (
        f"Corpus fixture assumption broken, decoded image sizes are {expected_sizes}."
    )

    assert images[0].get("decoded") is True and images[0].get("reason") is None, (
        f"The first image must be decoded with cap 512, got {images[0]!r}."
    )
    assert (images[0].get("width"), images[0].get("height")) == (7, 5), (
        f"Unexpected size for the first image: {images[0]!r}."
    )
    assert images[1].get("decoded") is True and images[1].get("reason") is None, (
        f"The second image must be decoded with cap 512, got {images[1]!r}."
    )
    assert (images[1].get("width"), images[1].get("height")) == (12, 9), (
        f"Unexpected size for the second image: {images[1]!r}."
    )
    assert images[2].get("decoded") is False, (
        f"The third image exceeds the cap and must not be decoded, got {images[2]!r}."
    )
    assert images[2].get("reason") == "size_limit", (
        f"Expected reason 'size_limit' for the oversized image, got {images[2].get('reason')!r}."
    )
    assert images[2].get("width") is None and images[2].get("height") is None, (
        f"A rejected image must report null dimensions, got {images[2]!r}."
    )
    assert doc.get("image_size_warnings") == 1, (
        f"Expected exactly 1 size-limit warning, got {doc.get('image_size_warnings')!r}."
    )


def test_large_cap_decodes_every_image(report_big):
    assert report_big.get("max_image_bytes") == 100000, (
        f"The report must echo the cap 100000, got {report_big.get('max_image_bytes')!r}."
    )
    assert report_big["totals"].get("images_decoded") == 3, (
        f"With a 100000 byte cap all 3 images must decode, got {report_big['totals']!r}."
    )
    doc = _document(report_big, "05_code_and_images")
    images = doc.get("images")
    assert [(img.get("decoded"), img.get("width"), img.get("height"), img.get("reason")) for img in images] == [
        (True, 7, 5, None),
        (True, 12, 9, None),
        (True, 64, 64, None),
    ], f"Unexpected image results with a large cap: {images!r}."
    assert doc.get("image_size_warnings") == 0, (
        f"No size-limit warning may be raised with a large cap, got {doc.get('image_size_warnings')!r}."
    )


def test_tiny_cap_rejects_every_image(report_tiny, report_512):
    assert report_tiny["totals"].get("images_decoded") == 0, (
        f"With a 10 byte cap no image may decode, got {report_tiny['totals']!r}."
    )
    doc = _document(report_tiny, "05_code_and_images")
    images = doc.get("images")
    assert [(img.get("decoded"), img.get("width"), img.get("height"), img.get("reason")) for img in images] == [
        (False, None, None, "size_limit"),
        (False, None, None, "size_limit"),
        (False, None, None, "size_limit"),
    ], f"Unexpected image results with a tiny cap: {images!r}."
    assert doc.get("image_size_warnings") == 3, (
        "Every size-limit warning event must be counted (3 expected), got "
        f"{doc.get('image_size_warnings')!r}."
    )
    for tiny_doc, base_doc in zip(report_tiny["documents"], report_512["documents"]):
        assert tiny_doc.get("tables") == base_doc.get("tables"), (
            "The image cap must not change table results for document "
            f"{base_doc.get('name')!r}."
        )


def test_generalizes_to_unseen_document(report_extra):
    assert [doc.get("name") for doc in report_extra["documents"]] == ["90_extra"], (
        f"Unexpected documents for the extra corpus: {report_extra['documents']!r}."
    )
    assert report_extra.get("failed") == [], (
        f"The extra corpus has no undecodable file, got {report_extra.get('failed')!r}."
    )
    doc = _document(report_extra, "90_extra")
    tables = doc.get("tables")
    assert isinstance(tables, list) and len(tables) == 1, (
        f"90_extra must report exactly 1 table, got {tables!r}."
    )
    table = tables[0]
    assert (table.get("num_rows"), table.get("num_cols")) == (3, 3), (
        f"Expected a 3x3 table, got {table.get('num_rows')}x{table.get('num_cols')}."
    )
    assert table.get("cell_count") == 9 and table.get("docling_cell_count") == 9, (
        "Expected cell_count and docling_cell_count of 9, got "
        f"{table.get('cell_count')!r} and {table.get('docling_cell_count')!r}."
    )
    assert table.get("alignments") == ["center", "right", "none"], (
        f"Unexpected alignments: {table.get('alignments')!r}."
    )
    assert table.get("grid") == [
        ["Item", "Qty", "Price"],
        ["widget | pro", "3", ""],
        ["gizmo", "4", "9.99"],
    ], f"Unexpected grid: {table.get('grid')!r}."
    assert doc.get("pipe_prose") == ["Totals | are | below"], (
        f"Unexpected pipe_prose: {doc.get('pipe_prose')!r}."
    )
    assert doc.get("code_blocks") == [], f"Unexpected code_blocks: {doc.get('code_blocks')!r}."
    assert doc.get("images") == [], f"Unexpected images: {doc.get('images')!r}."
    assert report_extra.get("totals") == {
        "documents": 1,
        "failed": 0,
        "tables": 1,
        "table_cells": 9,
        "code_blocks": 0,
        "images": 0,
        "images_decoded": 0,
    }, f"Unexpected totals for the extra corpus: {report_extra.get('totals')!r}."


def test_solution_uses_docling(report_512):
    hits = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in {".venv", "venv", "site-packages", "__pycache__"}]
        for name in files:
            if not name.endswith(".py"):
                continue
            path = os.path.join(root, name)
            try:
                with open(path, encoding="utf-8") as handle:
                    content = handle.read()
            except (UnicodeDecodeError, OSError):
                continue
            if re.search(r"^\s*(from|import)\s+docling", content, re.MULTILINE):
                hits.append(path)
    assert hits, (
        f"No Python source under {PROJECT_DIR} imports docling; the audit must convert "
        "the documents with docling."
    )


def test_corpus_is_not_modified(report_512, report_big, report_tiny):
    image_doc = os.path.join(CORPUS_DIR, "05_code_and_images.md")
    with open(image_doc, encoding="utf-8") as handle:
        image_content = handle.read()
    assert image_content.count("data:image/png;base64,") == 3, (
        f"The audit must not rewrite the corpus: {image_doc} no longer holds 3 data URIs."
    )
    ragged_doc = os.path.join(CORPUS_DIR, "03_ragged_cells.md")
    with open(ragged_doc, encoding="utf-8") as handle:
        ragged_content = handle.read()
    assert "\\|" in ragged_content, (
        f"The audit must not rewrite the corpus: {ragged_doc} lost its escaped pipe."
    )
