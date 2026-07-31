import hashlib
import importlib
import json
import os
import shutil
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import pytest

PROJECT_DIR = "/home/user/project"
CORPUS_DIR = Path(PROJECT_DIR) / "corpus"
CLEAN_OUT = Path("/tmp/rcp_check_clean")
MIXED_OUT = Path("/tmp/rcp_check_mixed")
RERUN_OUT = Path("/tmp/rcp_check_rerun")
MISSING_OUT = Path("/tmp/rcp_check_missing")

CLI_TIMEOUT = 900

if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

from docling.datamodel.base_models import (  # noqa: E402
    ConversionStatus,
    DocumentStream,
)
from docling.document_converter import DocumentConverter  # noqa: E402
from docling_core.transforms.chunker.hierarchical_chunker import (  # noqa: E402
    HierarchicalChunker,
)
from docling_core.types.doc import DocItemLabel, DoclingDocument  # noqa: E402

TRACEBACK_MARKER = "Traceback (most recent call last)"


def _load_plugin():
    module = importlib.import_module("rcp_plugin")
    assert hasattr(module, "build_converter"), (
        "rcp_plugin does not expose a build_converter() function."
    )
    return module


def _convert(converter, source):
    return converter.convert(source, raises_on_error=False)


def _section_headers(doc):
    return [t for t in doc.texts if t.label == DocItemLabel.SECTION_HEADER]


def _list_items(doc):
    return [t for t in doc.texts if t.label == DocItemLabel.LIST_ITEM]


def _chunks(doc):
    return list(HierarchicalChunker().chunk(dl_doc=doc))


def _run_cli(input_dir, output_dir):
    return subprocess.run(
        [
            sys.executable,
            "rcp_convert.py",
            "--input-dir",
            str(input_dir),
            "--output-dir",
            str(output_dir),
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=CLI_TIMEOUT,
    )


def _snapshot(root: Path):
    return {
        str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


@pytest.fixture(scope="session")
def converter():
    module = _load_plugin()
    built = module.build_converter()
    return built


@pytest.fixture(scope="session")
def alpha_doc(converter):
    result = _convert(converter, CORPUS_DIR / "clean" / "alpha.rcp")
    assert result.status == ConversionStatus.SUCCESS, (
        f"Converting corpus/clean/alpha.rcp returned status {result.status!r}."
    )
    assert isinstance(result.document, DoclingDocument), (
        "The conversion of corpus/clean/alpha.rcp did not return a DoclingDocument."
    )
    return result.document


@pytest.fixture(scope="session")
def clean_run():
    if CLEAN_OUT.exists():
        shutil.rmtree(CLEAN_OUT)
    proc = _run_cli("corpus/clean", CLEAN_OUT)
    print("clean stdout:", proc.stdout)
    print("clean stderr:", proc.stderr)
    return proc


@pytest.fixture(scope="session")
def mixed_run():
    if MIXED_OUT.exists():
        shutil.rmtree(MIXED_OUT)
    proc = _run_cli("corpus/mixed", MIXED_OUT)
    print("mixed stdout:", proc.stdout)
    print("mixed stderr:", proc.stderr)
    return proc


@pytest.fixture(scope="session")
def mixed_summary(mixed_run):
    path = MIXED_OUT / "summary.json"
    assert path.is_file(), f"{path} was not created by the batch CLI."
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture(scope="session")
def mixed_chunks(mixed_run):
    path = MIXED_OUT / "chunks.jsonl"
    assert path.is_file(), f"{path} was not created by the batch CLI."
    records = []
    with open(path, encoding="utf-8") as handle:
        for lineno, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                pytest.fail(f"Line {lineno} of chunks.jsonl is not valid JSON: {exc}")
    return records


def test_deliverable_files_and_converter_factory(converter):
    for name in ("rcp_plugin.py", "rcp_convert.py"):
        path = os.path.join(PROJECT_DIR, name)
        assert os.path.isfile(path), f"Required deliverable {path} does not exist."
    assert isinstance(converter, DocumentConverter), (
        "rcp_plugin.build_converter() must return a docling DocumentConverter "
        f"instance, got {type(converter)!r}."
    )


def test_rcp_path_conversion_succeeds(alpha_doc):
    assert alpha_doc.name == "alpha-run", (
        f"Document name must be the RCP header id 'alpha-run', got {alpha_doc.name!r}."
    )
    first_item = None
    for item, _level in alpha_doc.iterate_items():
        first_item = item
        break
    assert first_item is not None, "The converted document has no body elements."
    assert getattr(first_item, "label", None) == DocItemLabel.TITLE, (
        "The first body element must be the title element, got "
        f"{getattr(first_item, 'label', None)!r}."
    )
    assert getattr(first_item, "text", None) == "Cold Brew Concentrate", (
        "The title text must be the RCP header title 'Cold Brew Concentrate', got "
        f"{getattr(first_item, 'text', None)!r}."
    )


def test_headings_have_expected_text_and_levels(alpha_doc):
    headings = [(h.text, h.level) for h in _section_headers(alpha_doc)]
    expected = [
        ("Ingredients", 1),
        ("Substitutions", 2),
        ("Method", 1),
        ("Timing Notes", 3),
    ]
    assert headings == expected, (
        f"Expected section headings {expected} in document order, got {headings}."
    )


def test_heading_hierarchy_is_nested(alpha_doc):
    chunks = _chunks(alpha_doc)
    by_text = {chunk.text: list(chunk.meta.headings or []) for chunk in chunks}

    nested = by_text.get("Decaf beans work with the same ratio.")
    assert nested is not None, (
        "No chunk with the text of the paragraph under 'Substitutions' was produced; "
        f"available chunk texts: {sorted(by_text)}"
    )
    assert nested and nested[-1] == "Substitutions", (
        f"The heading path of the 'Substitutions' paragraph must end with "
        f"'Substitutions', got {nested}."
    )
    assert "Ingredients" in nested[:-1], (
        "'Substitutions' (level 2) must be nested inside 'Ingredients' (level 1); "
        f"heading path was {nested}."
    )

    skipped = by_text.get("Longer steeping increases bitterness.")
    assert skipped is not None, (
        "No chunk with the text of the paragraph under 'Timing Notes' was produced; "
        f"available chunk texts: {sorted(by_text)}"
    )
    assert skipped and skipped[-1] == "Timing Notes", (
        f"The heading path of the 'Timing Notes' paragraph must end with "
        f"'Timing Notes', got {skipped}."
    )
    assert "Method" in skipped[:-1], (
        "'Timing Notes' (level 3) must be nested inside the closest preceding smaller "
        f"level heading 'Method' (level 1); heading path was {skipped}."
    )
    assert "Ingredients" not in skipped, (
        "'Timing Notes' must not be nested inside 'Ingredients'; heading path was "
        f"{skipped}."
    )


def test_ordered_and_unordered_lists(alpha_doc):
    items = _list_items(alpha_doc)
    texts = [item.text for item in items]
    expected = [
        "120 g coarse coffee",
        "1000 ml filtered water",
        "Combine coffee and water in a 2 litre jar.",
        "Steep for 16 hours at room temperature.",
        "Filter twice through a paper cone.",
    ]
    assert texts == expected, (
        f"Expected list items {expected} in document order, got {texts}."
    )
    enumerated = [bool(getattr(item, "enumerated", False)) for item in items]
    assert enumerated == [False, False, True, True, True], (
        "The two 'B>' bullets must be non-enumerated and the three 'N>' steps must be "
        f"enumerated, got enumerated flags {enumerated}."
    )
    parents = [item.parent.cref if item.parent is not None else None for item in items]
    assert parents[0] == parents[1], (
        f"The two bullets must belong to the same list, got parents {parents[:2]}."
    )
    assert parents[2] == parents[3] == parents[4], (
        f"The three steps must belong to the same list, got parents {parents[2:]}."
    )
    assert parents[0] != parents[2], (
        "The bullet list and the step list must be two distinct lists, both are "
        f"{parents[0]!r}."
    )


def test_table_structure_and_headers(alpha_doc, converter):
    assert len(alpha_doc.tables) == 1, (
        f"corpus/clean/alpha.rcp must yield exactly 1 table, got {len(alpha_doc.tables)}."
    )
    table = alpha_doc.tables[0]
    assert (table.data.num_rows, table.data.num_cols) == (4, 3), (
        "The alpha table must be 4 rows x 3 columns, got "
        f"{table.data.num_rows} x {table.data.num_cols}."
    )
    header_texts = [cell.text for cell in table.data.grid[0]]
    assert header_texts == ["Component", "Amount", "Note"], (
        f"Unexpected header row cells: {header_texts}."
    )
    assert all(cell.column_header for cell in table.data.grid[0]), (
        "All cells of the first table row must be flagged as column headers."
    )
    assert table.data.grid[2][0].text == "Water", (
        "Cell in row index 2, column index 0 must be 'Water', got "
        f"{table.data.grid[2][0].text!r}."
    )
    assert table.data.grid[3][1].text == "400 g", (
        "Cell in row index 3, column index 1 must be '400 g', got "
        f"{table.data.grid[3][1].text!r}."
    )

    bravo = _convert(converter, CORPUS_DIR / "clean" / "bravo.rcp")
    assert bravo.status == ConversionStatus.SUCCESS, (
        f"Converting corpus/clean/bravo.rcp returned status {bravo.status!r}."
    )
    bravo_doc = bravo.document
    assert len(bravo_doc.tables) == 1, (
        f"corpus/clean/bravo.rcp must yield exactly 1 table, got {len(bravo_doc.tables)}."
    )
    bravo_table = bravo_doc.tables[0]
    assert (bravo_table.data.num_rows, bravo_table.data.num_cols) == (3, 2), (
        "The bravo table must be 3 rows x 2 columns, got "
        f"{bravo_table.data.num_rows} x {bravo_table.data.num_cols}."
    )
    bravo_headers = [cell.text for cell in bravo_table.data.grid[0]]
    assert bravo_headers == ["Day", "pH"], (
        f"Unexpected bravo header cells: {bravo_headers}."
    )


def test_figure_caption_and_annotation(alpha_doc):
    assert len(alpha_doc.pictures) == 1, (
        f"corpus/clean/alpha.rcp must yield exactly 1 picture, got "
        f"{len(alpha_doc.pictures)}."
    )
    caption = alpha_doc.pictures[0].caption_text(alpha_doc)
    assert caption == "Steeping jar after 16 hours", (
        f"The picture caption must be 'Steeping jar after 16 hours', got {caption!r}."
    )
    texts = [t.text for t in alpha_doc.texts]
    assert "NOTE: Chicory changes the extraction time." in texts, (
        "An annotation must become a text element prefixed with 'NOTE: '; document "
        f"texts were {texts}."
    )
    assert "Chicory changes the extraction time." not in texts, (
        "The annotation text must not also appear without the 'NOTE: ' prefix."
    )


def test_document_stream_input_is_supported(converter, alpha_doc):
    data = (CORPUS_DIR / "clean" / "alpha.rcp").read_bytes()
    stream = DocumentStream(name="alpha.rcp", stream=BytesIO(data))
    result = _convert(converter, stream)
    assert result.status == ConversionStatus.SUCCESS, (
        "Converting an in-memory '.rcp' document stream returned status "
        f"{result.status!r}."
    )
    doc = result.document
    assert isinstance(doc, DoclingDocument), (
        "Converting an in-memory '.rcp' document stream did not return a DoclingDocument."
    )
    assert doc.name == "alpha-run", (
        f"Stream conversion must use the header id as document name, got {doc.name!r}."
    )
    assert len(_section_headers(doc)) == len(_section_headers(alpha_doc)), (
        "Stream conversion produced a different number of section headings than path "
        "conversion."
    )
    assert len(doc.tables) == len(alpha_doc.tables), (
        "Stream conversion produced a different number of tables than path conversion."
    )
    assert len(doc.pictures) == len(alpha_doc.pictures), (
        "Stream conversion produced a different number of pictures than path conversion."
    )


@pytest.mark.parametrize(
    "filename,body_text",
    [
        ("bad_magic.rcp", "This file must be rejected."),
        ("dup_key.rcp", "This file must be rejected."),
        ("missing_title.rcp", "This file must be rejected."),
        ("no_terminator.rcp", "This file must be rejected."),
        ("ragged_table.rcp", "Data"),
        ("unknown_marker.rcp", "This marker does not exist."),
    ],
)
def test_malformed_files_report_conversion_failure(converter, filename, body_text):
    path = CORPUS_DIR / "malformed" / filename
    try:
        result = _convert(converter, path)
    except Exception as exc:  # noqa: BLE001
        pytest.fail(
            f"Converting malformed {filename} raised {type(exc).__name__}: {exc} "
            "instead of reporting a failure status."
        )
    assert result.status == ConversionStatus.FAILURE, (
        f"Malformed file {filename} must convert with a failure status, got "
        f"{result.status!r}."
    )
    doc = result.document
    if isinstance(doc, DoclingDocument):
        texts = [t.text for t in doc.texts]
        assert body_text not in texts, (
            f"Malformed file {filename} must not produce document content, but "
            f"{body_text!r} was found in {texts}."
        )


def test_native_markdown_conversion_still_works(converter):
    result = _convert(converter, CORPUS_DIR / "clean" / "readme.md")
    assert result.status == ConversionStatus.SUCCESS, (
        f"Converting corpus/clean/readme.md returned status {result.status!r}."
    )
    doc = result.document
    assert len(doc.tables) == 1, (
        f"corpus/clean/readme.md must yield 1 table, got {len(doc.tables)}."
    )
    assert len(_list_items(doc)) == 2, (
        f"corpus/clean/readme.md must yield 2 list items, got {len(_list_items(doc))}."
    )
    heading_texts = [h.text for h in _section_headers(doc)]
    assert "Highlights" in heading_texts, (
        f"Expected a 'Highlights' section heading, got {heading_texts}."
    )


def test_unsupported_format_is_not_reported_as_success(converter):
    result = _convert(converter, CORPUS_DIR / "unsupported" / "inventory.csv")
    assert result.status != ConversionStatus.SUCCESS, (
        "A '.csv' input must not be converted successfully by the RCP/Markdown "
        f"converter, got status {result.status!r}."
    )


def test_cli_happy_path_on_clean_corpus(clean_run):
    assert clean_run.returncode == 0, (
        "The CLI must exit with code 0 when every input converts; got "
        f"{clean_run.returncode}. stderr: {clean_run.stderr}"
    )
    assert TRACEBACK_MARKER not in clean_run.stderr, (
        f"The CLI printed a Python traceback on stderr: {clean_run.stderr}"
    )
    lines = [line for line in clean_run.stdout.splitlines() if line.strip()]
    assert lines, "The CLI printed nothing on stdout."
    assert lines[-1].strip() == "converted=3 failed=0 total=3", (
        "The last stdout line must be 'converted=3 failed=0 total=3', got "
        f"{lines[-1]!r}."
    )
    for rel in [
        "markdown/alpha.md",
        "markdown/bravo.md",
        "markdown/readme.md",
        "json/alpha.json",
        "json/bravo.json",
        "json/readme.json",
        "chunks.jsonl",
        "summary.json",
    ]:
        assert (CLEAN_OUT / rel).is_file(), (
            f"Expected output file {CLEAN_OUT / rel} was not created."
        )


def test_cli_mixed_corpus_accounting(mixed_run, mixed_summary):
    assert mixed_run.returncode == 1, (
        "The CLI must exit with code 1 when at least one input fails; got "
        f"{mixed_run.returncode}. stderr: {mixed_run.stderr}"
    )
    assert TRACEBACK_MARKER not in mixed_run.stderr, (
        f"The CLI printed a Python traceback on stderr: {mixed_run.stderr}"
    )
    lines = [line for line in mixed_run.stdout.splitlines() if line.strip()]
    last_line = lines[-1].strip() if lines else None
    assert last_line == "converted=3 failed=1 total=4", (
        f"The last stdout line must be 'converted=3 failed=1 total=4', got {last_line!r}."
    )
    assert set(mixed_summary) == {"schema_version", "counts", "documents"}, (
        f"summary.json must have exactly the top-level keys schema_version, counts and "
        f"documents, got {sorted(mixed_summary)}."
    )
    assert mixed_summary["schema_version"] == 1, (
        f"schema_version must be 1, got {mixed_summary['schema_version']!r}."
    )
    assert mixed_summary["counts"] == {"total": 4, "succeeded": 3, "failed": 1}, (
        f"Unexpected counts object: {mixed_summary['counts']}."
    )
    files = [entry["file"] for entry in mixed_summary["documents"]]
    assert files == ["alpha.rcp", "bravo.rcp", "broken.rcp", "readme.md"], (
        f"documents must list exactly the four convertible inputs in ascending "
        f"file-name order, got {files}."
    )
    formats = [entry["format"] for entry in mixed_summary["documents"]]
    assert formats == ["rcp", "rcp", "rcp", "md"], (
        f"Unexpected format values: {formats}."
    )
    expected_keys = {
        "file",
        "format",
        "status",
        "num_headings",
        "num_list_items",
        "num_tables",
        "num_pictures",
        "num_chunks",
        "sha256",
    }
    for entry in mixed_summary["documents"]:
        assert set(entry) == expected_keys, (
            f"Entry for {entry.get('file')!r} must have exactly the keys "
            f"{sorted(expected_keys)}, got {sorted(entry)}."
        )


def test_cli_failed_document_has_no_outputs(mixed_summary, mixed_chunks):
    broken = next(
        entry for entry in mixed_summary["documents"] if entry["file"] == "broken.rcp"
    )
    assert broken["status"] == "failure", (
        f"broken.rcp must be reported as a failure, got {broken['status']!r}."
    )
    for key in (
        "num_headings",
        "num_list_items",
        "num_tables",
        "num_pictures",
        "num_chunks",
    ):
        assert broken[key] == 0, (
            f"Failed document broken.rcp must report {key} == 0, got {broken[key]!r}."
        )
    assert not (MIXED_OUT / "markdown" / "broken.md").exists(), (
        "No markdown output may be written for the malformed input broken.rcp."
    )
    assert not (MIXED_OUT / "json" / "broken.json").exists(), (
        "No JSON output may be written for the malformed input broken.rcp."
    )
    assert all(record["file"] != "broken.rcp" for record in mixed_chunks), (
        "chunks.jsonl must not contain chunks for the malformed input broken.rcp."
    )


def test_cli_ignores_non_matching_files_and_subdirectories(mixed_summary):
    files = {entry["file"] for entry in mixed_summary["documents"]}
    for ignored in ("notes.txt", "inventory.csv", "deep.rcp"):
        assert ignored not in files, (
            f"{ignored} must not be processed by the batch CLI, but it appears in "
            "summary.json."
        )
    for path in (
        MIXED_OUT / "markdown" / "notes.md",
        MIXED_OUT / "json" / "notes.json",
        MIXED_OUT / "markdown" / "inventory.md",
        MIXED_OUT / "json" / "inventory.json",
        MIXED_OUT / "markdown" / "deep.md",
        MIXED_OUT / "json" / "deep.json",
    ):
        assert not path.exists(), f"Unexpected output file for an ignored input: {path}."


def test_cli_summary_numbers_match_docling_conversion(
    mixed_summary, mixed_chunks, converter
):
    by_file = {entry["file"]: entry for entry in mixed_summary["documents"]}

    expected_counts = {
        "alpha.rcp": (4, 5, 1, 1),
        "bravo.rcp": (2, 2, 1, 0),
    }
    for name, (headings, items, tables, pictures) in expected_counts.items():
        entry = by_file[name]
        assert (
            entry["num_headings"],
            entry["num_list_items"],
            entry["num_tables"],
            entry["num_pictures"],
        ) == (headings, items, tables, pictures), (
            f"Unexpected element counts for {name}: {entry}."
        )

    for name, entry in by_file.items():
        raw = (CORPUS_DIR / "mixed" / name).read_bytes()
        assert entry["sha256"] == hashlib.sha256(raw).hexdigest(), (
            f"The sha256 field for {name} does not match the input file's bytes."
        )
        lines_for_file = [r for r in mixed_chunks if r["file"] == name]
        assert entry["num_chunks"] == len(lines_for_file), (
            f"num_chunks for {name} is {entry['num_chunks']} but chunks.jsonl holds "
            f"{len(lines_for_file)} records for it."
        )

    for name in ("alpha.rcp", "bravo.rcp", "readme.md"):
        result = _convert(converter, CORPUS_DIR / "mixed" / name)
        assert result.status == ConversionStatus.SUCCESS, (
            f"Independent conversion of corpus/mixed/{name} returned {result.status!r}."
        )
        doc = result.document
        entry = by_file[name]
        assert entry["num_headings"] == len(_section_headers(doc)), (
            f"num_headings for {name} does not match the converted document."
        )
        assert entry["num_list_items"] == len(_list_items(doc)), (
            f"num_list_items for {name} does not match the converted document."
        )
        assert entry["num_tables"] == len(doc.tables), (
            f"num_tables for {name} does not match the converted document."
        )
        assert entry["num_pictures"] == len(doc.pictures), (
            f"num_pictures for {name} does not match the converted document."
        )


def test_cli_markdown_and_json_exports_match_conversion(mixed_run, converter):
    result = _convert(converter, CORPUS_DIR / "mixed" / "alpha.rcp")
    assert result.status == ConversionStatus.SUCCESS, (
        f"Independent conversion of corpus/mixed/alpha.rcp returned {result.status!r}."
    )
    expected_md = result.document.export_to_markdown()

    md_path = MIXED_OUT / "markdown" / "alpha.md"
    assert md_path.is_file(), f"{md_path} was not created."
    written_md = md_path.read_text(encoding="utf-8")
    assert written_md.strip() == expected_md.strip(), (
        "markdown/alpha.md does not match the Markdown export of the converted "
        f"document.\n--- written ---\n{written_md}\n--- expected ---\n{expected_md}"
    )
    for needle in ["## Ingredients", "### Substitutions"]:
        assert needle in written_md, (
            f"Expected {needle!r} in the exported Markdown, got:\n{written_md}"
        )
    assert "1. Combine coffee and water in a 2 litre jar." in written_md, (
        f"Expected the enumerated first step in the exported Markdown:\n{written_md}"
    )
    assert any(
        line.startswith("|") and "Coffee" in line for line in written_md.splitlines()
    ), f"Expected a Markdown table row containing 'Coffee':\n{written_md}"

    json_path = MIXED_OUT / "json" / "alpha.json"
    assert json_path.is_file(), f"{json_path} was not created."
    with open(json_path, encoding="utf-8") as handle:
        payload = json.load(handle)
    assert isinstance(payload, dict), "json/alpha.json must contain a JSON object."
    reloaded = DoclingDocument.model_validate(payload)
    assert reloaded.export_to_markdown().strip() == expected_md.strip(), (
        "json/alpha.json does not deserialize into an equivalent Docling document."
    )


def test_chunks_jsonl_structure_and_order(mixed_chunks, converter):
    assert mixed_chunks, "chunks.jsonl is empty."
    expected_keys = {"file", "chunk_index", "headings", "text", "num_chars"}
    for record in mixed_chunks:
        assert set(record) == expected_keys, (
            f"Every chunk record must have exactly the keys {sorted(expected_keys)}, "
            f"got {sorted(record)}."
        )
        assert isinstance(record["file"], str), "'file' must be a string."
        assert isinstance(record["chunk_index"], int), (
            "'chunk_index' must be an integer."
        )
        assert isinstance(record["headings"], list) and all(
            isinstance(h, str) for h in record["headings"]
        ), f"'headings' must be a list of strings, got {record['headings']!r}."
        assert isinstance(record["text"], str) and record["text"] != "", (
            "'text' must be a non-empty string."
        )
        assert record["num_chars"] == len(record["text"]), (
            f"num_chars {record['num_chars']} does not equal len(text) "
            f"{len(record['text'])}."
        )

    order = []
    per_file = {}
    for record in mixed_chunks:
        name = record["file"]
        if not order or order[-1] != name:
            assert name not in order, (
                f"Chunks for {name} are not grouped together in chunks.jsonl."
            )
            order.append(name)
        per_file.setdefault(name, []).append(record["chunk_index"])
    assert order == sorted(order), (
        f"Files in chunks.jsonl must appear in ascending file-name order, got {order}."
    )
    for name, indices in per_file.items():
        assert indices == list(range(len(indices))), (
            f"chunk_index values for {name} must start at 0 and increase by 1, got "
            f"{indices}."
        )

    for name in order:
        result = _convert(converter, CORPUS_DIR / "mixed" / name)
        doc = result.document
        allowed = {t.text for t in doc.texts}
        for record in mixed_chunks:
            if record["file"] != name:
                continue
            for heading in record["headings"]:
                assert heading in allowed, (
                    f"Heading {heading!r} in a chunk of {name} is not a text element of "
                    "the converted document."
                )

    alpha_paths = [
        record["headings"] for record in mixed_chunks if record["file"] == "alpha.rcp"
    ]
    assert any(path and path[-1] == "Substitutions" for path in alpha_paths), (
        f"No chunk of alpha.rcp has a heading path ending with 'Substitutions': "
        f"{alpha_paths}."
    )


def test_cli_reruns_are_byte_identical(mixed_run):
    if RERUN_OUT.exists():
        shutil.rmtree(RERUN_OUT)
    first = _run_cli("corpus/mixed", RERUN_OUT)
    assert first.returncode == 1, (
        f"First re-run exited with {first.returncode}. stderr: {first.stderr}"
    )
    snapshot_first = _snapshot(RERUN_OUT)
    second = _run_cli("corpus/mixed", RERUN_OUT)
    assert second.returncode == 1, (
        f"Second re-run exited with {second.returncode}. stderr: {second.stderr}"
    )
    snapshot_second = _snapshot(RERUN_OUT)
    assert snapshot_first == snapshot_second, (
        "Re-running the CLI with the same inputs must rewrite byte-identical output "
        "files."
    )
    snapshot_mixed = _snapshot(MIXED_OUT)
    assert snapshot_mixed == snapshot_second, (
        "Output written to a fresh directory differs from the earlier run over the "
        "same input directory."
    )


def test_cli_missing_input_directory_exit_code(mixed_run):
    if MISSING_OUT.exists():
        shutil.rmtree(MISSING_OUT)
    proc = _run_cli("corpus/does_not_exist", MISSING_OUT)
    assert proc.returncode == 2, (
        "The CLI must exit with code 2 when the input directory does not exist, got "
        f"{proc.returncode}. stderr: {proc.stderr}"
    )
    assert TRACEBACK_MARKER not in proc.stderr, (
        f"The CLI printed a Python traceback on stderr: {proc.stderr}"
    )
