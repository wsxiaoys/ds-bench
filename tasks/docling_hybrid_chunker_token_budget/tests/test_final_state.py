import json
import os
import shutil
import subprocess
import tempfile

import pytest

PROJECT_DIR = "/home/user/chunkforge"
SCRIPT = "chunkpack.py"
CORPUS_DIR = os.path.join(PROJECT_DIR, "assets", "corpus")
TOKENIZER_DIR = os.path.join(PROJECT_DIR, "assets", "tokenizer")
OUT_DIR = os.path.join(PROJECT_DIR, "out")
CHUNKS_PATH = os.path.join(OUT_DIR, "chunks.jsonl")
SUMMARY_PATH = os.path.join(OUT_DIR, "summary.json")

REQUIRED_CHUNK_KEYS = {
    "chunk_id",
    "index",
    "source",
    "ordinal",
    "heading_path",
    "page_numbers",
    "token_count",
    "is_partial_element",
    "text",
}
REQUIRED_SUMMARY_KEYS = {
    "tokenizer_path",
    "max_tokens",
    "merge_peers",
    "documents",
    "totals",
    "skipped_files",
}
REQUIRED_DOCUMENT_KEYS = {
    "source",
    "chunk_count",
    "token_total",
    "max_chunk_tokens",
    "mean_chunk_tokens",
    "partial_chunk_count",
    "max_heading_depth",
    "page_numbers",
}
REQUIRED_TOTALS_KEYS = {
    "document_count",
    "chunk_count",
    "token_total",
    "partial_chunk_count",
    "budget_violations",
}
EXPECTED_SOURCES = {
    "alpha_guide.md",
    "appendix/omega_notes.md",
    "beta_report.html",
    "delta_brief.pdf",
    "gamma_minutes.docx",
}
FULL_RUN_BUDGET = 128
FULL_RUN_TIMEOUT = 2400
MINI_RUN_TIMEOUT = 1200


def run_chunkpack(args, timeout):
    """Invoke the agent's CLI exactly the way the task description specifies."""
    return subprocess.run(
        ["python3", SCRIPT] + args,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def last_non_empty_line(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[-1] if lines else ""


def read_chunks(path):
    with open(path, encoding="utf-8") as handle:
        raw = handle.read()
    records = []
    for line_no, line in enumerate(raw.splitlines(), start=1):
        assert line.strip(), f"{path}: line {line_no} is empty."
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise AssertionError(f"{path}: line {line_no} is not valid JSON: {exc}") from exc
    return raw, records


@pytest.fixture(scope="session")
def committed_artifacts():
    assert os.path.isfile(CHUNKS_PATH), f"Missing required artifact {CHUNKS_PATH}."
    assert os.path.isfile(SUMMARY_PATH), f"Missing required artifact {SUMMARY_PATH}."
    raw, records = read_chunks(CHUNKS_PATH)
    with open(SUMMARY_PATH, encoding="utf-8") as handle:
        summary = json.load(handle)
    return raw, records, summary


@pytest.fixture(scope="session")
def chunks(committed_artifacts):
    return committed_artifacts[1]


@pytest.fixture(scope="session")
def summary(committed_artifacts):
    return committed_artifacts[2]


@pytest.fixture(scope="session")
def tokenizer():
    from transformers import AutoTokenizer

    return AutoTokenizer.from_pretrained(TOKENIZER_DIR)


@pytest.fixture(scope="session")
def mini_corpus():
    path = tempfile.mkdtemp(prefix="mini_corpus_")
    shutil.copyfile(
        os.path.join(CORPUS_DIR, "alpha_guide.md"), os.path.join(path, "alpha_guide.md")
    )
    return path


def pack_into(out_dir, corpus, max_tokens, extra=None, timeout=MINI_RUN_TIMEOUT):
    args = ["pack", "--corpus", corpus, "--out", out_dir, "--max-tokens", str(max_tokens)]
    if extra:
        args += extra
    result = run_chunkpack(args, timeout)
    assert result.returncode == 0, (
        f"'pack' with args {args} failed (exit {result.returncode}).\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    chunks_path = os.path.join(out_dir, "chunks.jsonl")
    summary_path = os.path.join(out_dir, "summary.json")
    assert os.path.isfile(chunks_path), f"'pack' did not create {chunks_path}."
    assert os.path.isfile(summary_path), f"'pack' did not create {summary_path}."
    raw, records = read_chunks(chunks_path)
    with open(summary_path, encoding="utf-8") as handle:
        run_summary = json.load(handle)
    return result, raw, records, run_summary


@pytest.fixture(scope="session")
def full_rerun():
    out_dir = os.path.join(tempfile.mkdtemp(prefix="full_rerun_"), "rerun")
    return pack_into(out_dir, CORPUS_DIR, FULL_RUN_BUDGET, timeout=FULL_RUN_TIMEOUT) + (out_dir,)


@pytest.fixture(scope="session")
def mini_merged(mini_corpus):
    out_dir = os.path.join(tempfile.mkdtemp(prefix="mini_merge_"), "out")
    first = pack_into(out_dir, mini_corpus, 96)
    second = pack_into(out_dir, mini_corpus, 96)
    return first, second


@pytest.fixture(scope="session")
def mini_unmerged(mini_corpus):
    out_dir = os.path.join(tempfile.mkdtemp(prefix="mini_nomerge_"), "out")
    return pack_into(out_dir, mini_corpus, 96, extra=["--no-merge-peers"])


@pytest.fixture(scope="session")
def mini_budget_64(mini_corpus):
    out_dir = os.path.join(tempfile.mkdtemp(prefix="mini_64_"), "out")
    return pack_into(out_dir, mini_corpus, 64)


@pytest.fixture(scope="session")
def mini_budget_256(mini_corpus):
    out_dir = os.path.join(tempfile.mkdtemp(prefix="mini_256_"), "out")
    return pack_into(out_dir, mini_corpus, 256)


def make_tampered_copy(mutate):
    """Copy the committed artifacts into a temp dir and mutate one JSONL record."""
    tmp_dir = os.path.join(tempfile.mkdtemp(prefix="tampered_"), "out")
    shutil.copytree(OUT_DIR, tmp_dir)
    chunks_path = os.path.join(tmp_dir, "chunks.jsonl")
    with open(chunks_path, encoding="utf-8") as handle:
        records = [json.loads(line) for line in handle if line.strip()]
    assert records, "The committed chunks.jsonl contains no records to tamper with."
    mutate(records[0])
    with open(chunks_path, "w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return tmp_dir


def test_deliverables_exist_and_are_well_formed(committed_artifacts):
    raw, records, _ = committed_artifacts
    assert os.path.isfile(os.path.join(PROJECT_DIR, SCRIPT)), (
        f"Missing CLI entrypoint {os.path.join(PROJECT_DIR, SCRIPT)}."
    )
    assert records, "out/chunks.jsonl contains no chunk records."
    assert raw.endswith("\n"), "out/chunks.jsonl must end with a trailing newline."
    assert "\r" not in raw, "out/chunks.jsonl must not contain carriage return characters."


def test_chunk_record_schema_and_types(chunks):
    for record in chunks:
        assert isinstance(record, dict), f"Chunk record is not a JSON object: {record!r}"
        assert set(record) == REQUIRED_CHUNK_KEYS, (
            f"Chunk {record.get('chunk_id')!r} has key set {sorted(record)}, "
            f"expected exactly {sorted(REQUIRED_CHUNK_KEYS)}."
        )
        assert isinstance(record["chunk_id"], str) and record["chunk_id"], "chunk_id must be a non-empty string."
        assert isinstance(record["source"], str) and record["source"], "source must be a non-empty string."
        assert isinstance(record["index"], int) and not isinstance(record["index"], bool), (
            f"index of {record['chunk_id']!r} must be an integer."
        )
        assert isinstance(record["ordinal"], int) and not isinstance(record["ordinal"], bool), (
            f"ordinal of {record['chunk_id']!r} must be an integer."
        )
        assert isinstance(record["token_count"], int) and not isinstance(record["token_count"], bool), (
            f"token_count of {record['chunk_id']!r} must be an integer."
        )
        assert isinstance(record["is_partial_element"], bool), (
            f"is_partial_element of {record['chunk_id']!r} must be a boolean."
        )
        assert isinstance(record["heading_path"], list), (
            f"heading_path of {record['chunk_id']!r} must be a list."
        )
        for heading in record["heading_path"]:
            assert isinstance(heading, str) and heading.strip(), (
                f"heading_path of {record['chunk_id']!r} contains an empty/non-string entry."
            )
        assert isinstance(record["page_numbers"], list), (
            f"page_numbers of {record['chunk_id']!r} must be a list."
        )
        for page in record["page_numbers"]:
            assert isinstance(page, int) and not isinstance(page, bool) and page >= 1, (
                f"page_numbers of {record['chunk_id']!r} must hold integers >= 1, got {page!r}."
            )
        pages = record["page_numbers"]
        assert pages == sorted(set(pages)), (
            f"page_numbers of {record['chunk_id']!r} must be ascending and duplicate-free, got {pages}."
        )
        assert isinstance(record["text"], str) and record["text"].strip(), (
            f"text of {record['chunk_id']!r} must be a non-empty string."
        )


def test_index_ordinal_and_chunk_id_contract(chunks):
    for position, record in enumerate(chunks):
        assert record["index"] == position, (
            f"index values must be 0..N-1 in file order; line {position} has index {record['index']}."
        )

    order = []
    per_source = {}
    for record in chunks:
        source = record["source"]
        if not order or order[-1] != source:
            assert source not in order, (
                f"Chunks of source {source!r} are not contiguous in chunks.jsonl."
            )
            order.append(source)
        per_source.setdefault(source, []).append(record)

    assert order == sorted(order), (
        f"Sources must appear in ascending order, got {order}."
    )
    for source, records in per_source.items():
        ordinals = [record["ordinal"] for record in records]
        assert ordinals == list(range(len(records))), (
            f"Ordinals of {source!r} must be 0..k-1 in order, got {ordinals}."
        )
        for record in records:
            expected_id = "{}#{:04d}".format(source, record["ordinal"])
            assert record["chunk_id"] == expected_id, (
                f"chunk_id must be {expected_id!r}, got {record['chunk_id']!r}."
            )


def test_only_supported_sources_are_chunked(chunks, summary):
    sources = {record["source"] for record in chunks}
    assert sources == EXPECTED_SOURCES, (
        f"Expected chunks for exactly {sorted(EXPECTED_SOURCES)}, got {sorted(sources)}."
    )
    assert summary.get("skipped_files") == ["notes.txt"], (
        f"summary.json skipped_files must be ['notes.txt'], got {summary.get('skipped_files')!r}."
    )


def test_token_budget_is_never_exceeded(chunks):
    for record in chunks:
        assert 0 < record["token_count"] <= FULL_RUN_BUDGET, (
            f"Chunk {record['chunk_id']!r} reports token_count {record['token_count']}, "
            f"which violates the budget of {FULL_RUN_BUDGET}."
        )


def test_token_counts_match_the_configured_tokenizer(chunks, tokenizer):
    for record in chunks:
        expected = len(tokenizer.tokenize(record["text"]))
        assert record["token_count"] == expected, (
            f"Chunk {record['chunk_id']!r} declares token_count {record['token_count']} "
            f"but the configured tokenizer counts {expected} tokens for its text."
        )


def test_contextualized_text_starts_with_heading_path(chunks):
    for record in chunks:
        headings = record["heading_path"]
        lines = record["text"].split("\n")
        assert lines[: len(headings)] == headings, (
            f"text of {record['chunk_id']!r} must start with its heading_path lines "
            f"{headings}, got {lines[: len(headings)]}."
        )
        body = "\n".join(lines[len(headings) :])
        assert body.strip(), (
            f"Chunk {record['chunk_id']!r} has no body content after its heading prefix."
        )


def test_deep_heading_nesting_is_captured(chunks):
    depths = [
        len(record["heading_path"])
        for record in chunks
        if record["source"] == "alpha_guide.md"
    ]
    assert depths, "No chunks were produced for alpha_guide.md."
    assert max(depths) >= 4, (
        f"alpha_guide.md has deeply nested sections; expected a heading_path of length >= 4, "
        f"got max depth {max(depths)}."
    )


def test_summary_structure_and_run_configuration(summary):
    assert set(summary) == REQUIRED_SUMMARY_KEYS, (
        f"summary.json has key set {sorted(summary)}, expected exactly {sorted(REQUIRED_SUMMARY_KEYS)}."
    )
    assert summary["tokenizer_path"] == TOKENIZER_DIR, (
        f"summary.json tokenizer_path must be {TOKENIZER_DIR!r}, got {summary['tokenizer_path']!r}."
    )
    assert summary["max_tokens"] == FULL_RUN_BUDGET, (
        f"summary.json max_tokens must be {FULL_RUN_BUDGET}, got {summary['max_tokens']!r}."
    )
    assert summary["merge_peers"] is True, (
        f"summary.json merge_peers must be true for the committed run, got {summary['merge_peers']!r}."
    )
    assert isinstance(summary["documents"], list) and summary["documents"], (
        "summary.json documents must be a non-empty list."
    )
    for document in summary["documents"]:
        assert set(document) == REQUIRED_DOCUMENT_KEYS, (
            f"summary.json document entry has key set {sorted(document)}, "
            f"expected exactly {sorted(REQUIRED_DOCUMENT_KEYS)}."
        )
    sources = [document["source"] for document in summary["documents"]]
    assert sources == sorted(sources), (
        f"summary.json documents must be ordered by source, got {sources}."
    )
    assert set(summary["totals"]) == REQUIRED_TOTALS_KEYS, (
        f"summary.json totals has key set {sorted(summary['totals'])}, "
        f"expected exactly {sorted(REQUIRED_TOTALS_KEYS)}."
    )


def test_summary_per_document_aggregates_match_chunks(chunks, summary):
    grouped = {}
    for record in chunks:
        grouped.setdefault(record["source"], []).append(record)

    reported = {document["source"]: document for document in summary["documents"]}
    assert set(reported) == set(grouped), (
        f"summary.json documents cover {sorted(reported)} but chunks.jsonl covers {sorted(grouped)}."
    )

    for source, records in grouped.items():
        document = reported[source]
        token_total = sum(record["token_count"] for record in records)
        pages = sorted({page for record in records for page in record["page_numbers"]})
        assert document["chunk_count"] == len(records), (
            f"chunk_count for {source!r} is {document['chunk_count']}, expected {len(records)}."
        )
        assert document["token_total"] == token_total, (
            f"token_total for {source!r} is {document['token_total']}, expected {token_total}."
        )
        assert document["max_chunk_tokens"] == max(record["token_count"] for record in records), (
            f"max_chunk_tokens for {source!r} is wrong."
        )
        assert abs(document["mean_chunk_tokens"] - token_total / len(records)) <= 0.01, (
            f"mean_chunk_tokens for {source!r} is {document['mean_chunk_tokens']}, "
            f"expected about {token_total / len(records):.2f}."
        )
        assert document["partial_chunk_count"] == sum(
            1 for record in records if record["is_partial_element"]
        ), f"partial_chunk_count for {source!r} does not match chunks.jsonl."
        assert document["max_heading_depth"] == max(
            len(record["heading_path"]) for record in records
        ), f"max_heading_depth for {source!r} does not match chunks.jsonl."
        assert document["page_numbers"] == pages, (
            f"page_numbers for {source!r} is {document['page_numbers']}, expected {pages}."
        )


def test_summary_totals_match_chunks(chunks, summary):
    totals = summary["totals"]
    sources = {record["source"] for record in chunks}
    assert totals["document_count"] == len(sources), (
        f"totals.document_count is {totals['document_count']}, expected {len(sources)}."
    )
    assert totals["chunk_count"] == len(chunks), (
        f"totals.chunk_count is {totals['chunk_count']}, expected {len(chunks)}."
    )
    assert totals["token_total"] == sum(record["token_count"] for record in chunks), (
        "totals.token_total does not match the sum of the chunk token counts."
    )
    assert totals["partial_chunk_count"] == sum(
        1 for record in chunks if record["is_partial_element"]
    ), "totals.partial_chunk_count does not match chunks.jsonl."
    assert totals["budget_violations"] == 0, (
        f"totals.budget_violations must be 0, got {totals['budget_violations']}."
    )


def test_oversized_element_is_split_without_losing_content(chunks):
    alpha = [record for record in chunks if record["source"] == "alpha_guide.md"]
    partial = [record for record in alpha if record["is_partial_element"]]
    assert len(partial) >= 2, (
        "alpha_guide.md contains a paragraph far larger than the 128-token budget, so at least "
        f"two chunks must be marked is_partial_element; found {len(partial)}."
    )
    for record in partial:
        assert record["token_count"] <= FULL_RUN_BUDGET, (
            f"Partial chunk {record['chunk_id']!r} exceeds the token budget."
        )
    combined = "\n".join(record["text"] for record in alpha)
    for marker in ("ZQXSENTINELALPHA", "ZQXSENTINELMIDDLE", "ZQXSENTINELOMEGA"):
        assert marker in combined, (
            f"Marker {marker} from alpha_guide.md is missing from the emitted chunks; "
            "no source content may be dropped."
        )


def test_table_content_is_preserved(chunks):
    beta = [record for record in chunks if record["source"] == "beta_report.html"]
    assert beta, "No chunks were produced for beta_report.html."
    combined = "\n".join(record["text"] for record in beta)
    for value in ("Region", "Zurich", "18420"):
        assert value in combined, (
            f"Table value {value!r} from beta_report.html is missing from the emitted chunks."
        )


def test_pdf_page_provenance_is_recorded(chunks):
    pdf_chunks = [record for record in chunks if record["source"] == "delta_brief.pdf"]
    assert pdf_chunks, "No chunks were produced for delta_brief.pdf."
    assert any(record["page_numbers"] for record in pdf_chunks), (
        "At least one chunk of delta_brief.pdf must carry page provenance."
    )
    pages = {page for record in pdf_chunks for page in record["page_numbers"]}
    assert pages <= {1}, (
        f"delta_brief.pdf has a single page, so only page 1 may appear, got {sorted(pages)}."
    )


def test_pack_stdout_contract_and_byte_identical_rerun(full_rerun, chunks, summary):
    result, raw, records, run_summary, out_dir = full_rerun
    expected_line = (
        f"PACKED documents={len(summary['documents'])} chunks={len(chunks)} "
        f"max_tokens={FULL_RUN_BUDGET} merge_peers=true"
    )
    assert last_non_empty_line(result.stdout) == expected_line, (
        f"The last non-empty stdout line must be {expected_line!r}, "
        f"got {last_non_empty_line(result.stdout)!r}."
    )
    with open(CHUNKS_PATH, "rb") as handle:
        committed_chunks = handle.read()
    with open(os.path.join(out_dir, "chunks.jsonl"), "rb") as handle:
        rerun_chunks = handle.read()
    assert rerun_chunks == committed_chunks, (
        "Re-running the packer with identical arguments must reproduce a byte-identical chunks.jsonl."
    )
    with open(SUMMARY_PATH, "rb") as handle:
        committed_summary = handle.read()
    with open(os.path.join(out_dir, "summary.json"), "rb") as handle:
        rerun_summary = handle.read()
    assert rerun_summary == committed_summary, (
        "Re-running the packer with identical arguments must reproduce a byte-identical summary.json."
    )
    assert len(records) == len(chunks), (
        f"The rerun produced {len(records)} chunks while the committed artifact has {len(chunks)}."
    )
    assert run_summary["totals"]["budget_violations"] == 0, (
        "The rerun reports budget violations."
    )


def test_pack_is_idempotent_into_an_existing_output_directory(mini_merged):
    first, second = mini_merged
    assert first[1] == second[1], (
        "Packing twice into the same output directory must leave an identical chunks.jsonl."
    )
    assert json.dumps(first[3], sort_keys=True) == json.dumps(second[3], sort_keys=True), (
        "Packing twice into the same output directory must leave an identical summary.json."
    )


def test_merge_peers_switch_changes_chunking(mini_merged, mini_unmerged):
    merged_records = mini_merged[0][2]
    merged_summary = mini_merged[0][3]
    unmerged_records = mini_unmerged[2]
    unmerged_summary = mini_unmerged[3]

    assert merged_summary["merge_peers"] is True, (
        "summary.json merge_peers must be true when --no-merge-peers is not given."
    )
    assert unmerged_summary["merge_peers"] is False, (
        "summary.json merge_peers must be false when --no-merge-peers is given."
    )
    for record in merged_records + unmerged_records:
        assert 0 < record["token_count"] <= 96, (
            f"Chunk {record['chunk_id']!r} violates the 96-token budget of the mini run."
        )
    assert len(unmerged_records) > len(merged_records), (
        "Disabling peer merging must yield strictly more chunks for a document with several "
        f"short consecutive paragraphs; got {len(unmerged_records)} without merging vs "
        f"{len(merged_records)} with merging."
    )


def test_smaller_budget_yields_more_chunks(mini_budget_64, mini_budget_256):
    small_records = mini_budget_64[2]
    large_records = mini_budget_256[2]
    for record in small_records:
        assert 0 < record["token_count"] <= 64, (
            f"Chunk {record['chunk_id']!r} violates the 64-token budget."
        )
    for record in large_records:
        assert 0 < record["token_count"] <= 256, (
            f"Chunk {record['chunk_id']!r} violates the 256-token budget."
        )
    assert mini_budget_64[3]["max_tokens"] == 64, "summary.json max_tokens must mirror the run budget."
    assert mini_budget_256[3]["max_tokens"] == 256, "summary.json max_tokens must mirror the run budget."
    assert len(small_records) > len(large_records), (
        f"A 64-token budget must produce strictly more chunks than a 256-token budget; got "
        f"{len(small_records)} vs {len(large_records)}."
    )


def test_verify_accepts_the_committed_artifacts():
    result = run_chunkpack(["verify", "--out", OUT_DIR], MINI_RUN_TIMEOUT)
    assert result.returncode == 0, (
        f"'verify' on the committed artifacts must exit 0, got {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert any(line.strip().startswith("VERIFIED") for line in result.stdout.splitlines()), (
        f"'verify' must print a line starting with 'VERIFIED' on stdout, got: {result.stdout!r}"
    )


@pytest.mark.parametrize(
    "label,mutate",
    [
        ("token_count", lambda record: record.__setitem__("token_count", record["token_count"] + 1000)),
        ("chunk_id", lambda record: record.__setitem__("chunk_id", "bogus#0000")),
        ("missing_key", lambda record: record.pop("page_numbers")),
    ],
)
def test_verify_rejects_tampered_artifacts(label, mutate):
    tampered_dir = make_tampered_copy(mutate)
    result = run_chunkpack(["verify", "--out", tampered_dir], MINI_RUN_TIMEOUT)
    assert result.returncode == 3, (
        f"'verify' must exit 3 for the tampered {label} artifact, got {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert any(line.strip().startswith("VIOLATION") for line in result.stderr.splitlines()), (
        f"'verify' must report a line starting with 'VIOLATION' on stderr for the tampered "
        f"{label} artifact, got: {result.stderr!r}"
    )
    assert "VERIFIED" not in result.stdout, (
        f"'verify' must not print 'VERIFIED' for the tampered {label} artifact."
    )


def test_pack_rejects_a_budget_below_the_minimum():
    out_dir = os.path.join(tempfile.mkdtemp(prefix="bad_budget_"), "out")
    result = run_chunkpack(
        ["pack", "--corpus", CORPUS_DIR, "--out", out_dir, "--max-tokens", "8"],
        FULL_RUN_TIMEOUT,
    )
    assert result.returncode == 2, (
        f"A --max-tokens value below 32 must exit 2, got {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert any(line.strip().startswith("ERROR") for line in result.stderr.splitlines()), (
        f"An invalid budget must produce a stderr message starting with 'ERROR', got: {result.stderr!r}"
    )


def test_pack_rejects_a_missing_corpus_directory():
    out_dir = os.path.join(tempfile.mkdtemp(prefix="missing_corpus_"), "out")
    result = run_chunkpack(
        [
            "pack",
            "--corpus",
            os.path.join(PROJECT_DIR, "assets", "does_not_exist"),
            "--out",
            out_dir,
            "--max-tokens",
            str(FULL_RUN_BUDGET),
        ],
        FULL_RUN_TIMEOUT,
    )
    assert result.returncode == 2, (
        f"A missing --corpus directory must exit 2, got {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert any(line.strip().startswith("ERROR") for line in result.stderr.splitlines()), (
        f"A missing corpus must produce a stderr message starting with 'ERROR', got: {result.stderr!r}"
    )


def test_verify_rejects_a_directory_without_artifacts():
    empty_dir = tempfile.mkdtemp(prefix="empty_out_")
    result = run_chunkpack(["verify", "--out", empty_dir], MINI_RUN_TIMEOUT)
    assert result.returncode == 2, (
        f"'verify' on a directory without artifacts must exit 2, got {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert any(line.strip().startswith("ERROR") for line in result.stderr.splitlines()), (
        f"'verify' on a directory without artifacts must print 'ERROR' on stderr, got: {result.stderr!r}"
    )
