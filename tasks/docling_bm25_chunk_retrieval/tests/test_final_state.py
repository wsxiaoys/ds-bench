import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
CHUNKS_PATH = os.path.join(OUTPUT_DIR, "chunks.json")
INDEX_PATH = os.path.join(OUTPUT_DIR, "bm25_index.idx")
QRESULTS_PATH = os.path.join(OUTPUT_DIR, "query_results.json")

REQUIRED_CHUNK_KEYS = {"chunk_id", "heading_path", "page_nos", "text", "term_count"}
EXPECTED_QUERY_IDS = {
    "q_onboarding",
    "q_billing",
    "q_crypto_heading",
    "q_hardware_table",
    "q_maintenance",
}

# Unambiguous answer markers ("sentinels") baked into the report content.
SENTINELS = {
    "q_onboarding": "ZEPHYR-4417",
    "q_billing": "kronelumen",
    "q_crypto_heading": "BLOWFISH-CASCADE",
    "q_hardware_table": "FCX-9",
    "q_maintenance": "512",
}

RESULT_TIMEOUT = 900


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


@pytest.fixture(scope="session")
def built_pipeline():
    """Build the index + chunks and run the seeded queries once for the suite."""
    # Start from a clean slate so we verify a fresh build, not stale artifacts.
    for path in (CHUNKS_PATH, INDEX_PATH, QRESULTS_PATH):
        if os.path.exists(path):
            os.remove(path)

    build = subprocess.run(
        ["python3", "main.py", "--build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RESULT_TIMEOUT,
    )
    assert build.returncode == 0, (
        "`python3 main.py --build` failed with return code "
        f"{build.returncode}.\nstdout:\n{build.stdout}\nstderr:\n{build.stderr}"
    )

    run_queries = subprocess.run(
        ["python3", "main.py", "--run-queries"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RESULT_TIMEOUT,
    )
    assert run_queries.returncode == 0, (
        "`python3 main.py --run-queries` failed with return code "
        f"{run_queries.returncode}.\nstdout:\n{run_queries.stdout}\nstderr:\n{run_queries.stderr}"
    )
    return True


@pytest.fixture(scope="session")
def chunks(built_pipeline):
    with open(CHUNKS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data


@pytest.fixture(scope="session")
def chunk_text_by_id(chunks):
    mapping = {}
    for obj in chunks:
        mapping[obj["chunk_id"]] = obj["text"]
    return mapping


@pytest.fixture(scope="session")
def query_results(built_pipeline):
    with open(QRESULTS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data


def test_artifacts_exist(built_pipeline):
    assert os.path.isfile(CHUNKS_PATH), f"Expected chunks file {CHUNKS_PATH} to exist."
    assert os.path.isfile(INDEX_PATH), f"Expected persisted index {INDEX_PATH} to exist."
    assert os.path.isfile(QRESULTS_PATH), f"Expected query results {QRESULTS_PATH} to exist."
    assert os.path.getsize(INDEX_PATH) > 0, f"Persisted index {INDEX_PATH} must be non-empty."


def test_chunks_schema_and_count(chunks):
    assert isinstance(chunks, list), "chunks.json must be a JSON array."
    assert 5 <= len(chunks) <= 60, (
        f"Expected between 5 and 60 chunks (one per section plus the table), found {len(chunks)}."
    )

    ids = []
    max_page = 0
    for obj in chunks:
        assert isinstance(obj, dict), "Every chunk entry must be a JSON object."
        assert REQUIRED_CHUNK_KEYS.issubset(obj.keys()), (
            f"Chunk object missing required keys {REQUIRED_CHUNK_KEYS}; found keys {set(obj.keys())}."
        )

        assert isinstance(obj["chunk_id"], int) and not isinstance(obj["chunk_id"], bool), (
            "chunk_id must be an integer."
        )
        ids.append(obj["chunk_id"])

        assert isinstance(obj["heading_path"], list) and all(
            isinstance(h, str) for h in obj["heading_path"]
        ), "heading_path must be a list of strings."

        page_nos = obj["page_nos"]
        assert isinstance(page_nos, list) and len(page_nos) > 0, "page_nos must be a non-empty list."
        assert all(isinstance(p, int) and not isinstance(p, bool) and p >= 1 for p in page_nos), (
            "page_nos must contain integers >= 1."
        )
        assert page_nos == sorted(page_nos), "page_nos must be sorted ascending."
        assert len(page_nos) == len(set(page_nos)), "page_nos must not contain duplicates."
        max_page = max(max_page, max(page_nos))

        assert isinstance(obj["text"], str) and obj["text"].strip(), "text must be a non-empty string."

        assert isinstance(obj["term_count"], int) and not isinstance(obj["term_count"], bool), (
            "term_count must be an integer."
        )
        assert obj["term_count"] > 0, "term_count must be greater than 0."

    assert sorted(ids) == list(range(len(chunks))), (
        f"chunk_id values must be the contiguous 0-based range 0..{len(chunks) - 1}; got {sorted(ids)}."
    )


def test_multipage_provenance(chunks):
    max_page = max(p for obj in chunks for p in obj["page_nos"])
    assert max_page >= 2, (
        f"The report spans two pages, so the maximum page number across chunks must be >= 2; got {max_page}."
    )


def test_table_content_preserved(chunks):
    matches = [obj for obj in chunks if "FCX-9" in obj["text"] and "88" in obj["text"]]
    assert matches, (
        "Expected at least one chunk whose text contains both the table cell 'FCX-9' and '88'."
    )


def test_heading_path_enrichment(chunks):
    crypto_chunks = [obj for obj in chunks if "BLOWFISH-CASCADE" in obj["text"]]
    assert crypto_chunks, "Expected a chunk whose text contains 'BLOWFISH-CASCADE'."
    for obj in crypto_chunks:
        assert "Cryptography Standards" in obj["heading_path"], (
            "The chunk containing 'BLOWFISH-CASCADE' must carry its section heading "
            f"'Cryptography Standards' in heading_path; got {obj['heading_path']}."
        )


def test_query_results_schema(query_results):
    assert isinstance(query_results, dict), "query_results.json must be a JSON object."
    assert set(query_results.keys()) == EXPECTED_QUERY_IDS, (
        f"query_results keys must be exactly {EXPECTED_QUERY_IDS}; got {set(query_results.keys())}."
    )
    for qid, ranking in query_results.items():
        assert isinstance(ranking, list), f"Results for {qid} must be a JSON array."
        assert 1 <= len(ranking) <= 5, (
            f"Results for {qid} must have between 1 and 5 entries; got {len(ranking)}."
        )
        for entry in ranking:
            assert isinstance(entry, dict), f"Each result for {qid} must be a JSON object."
            assert set(entry.keys()) == {"chunk_id", "score"}, (
                f"Each result for {qid} must have exactly the keys 'chunk_id' and 'score'; got {set(entry.keys())}."
            )
            assert isinstance(entry["chunk_id"], int) and not isinstance(entry["chunk_id"], bool), (
                f"chunk_id in results for {qid} must be an integer."
            )
            assert _is_number(entry["score"]), f"score in results for {qid} must be a number."


def test_score_monotonicity(query_results):
    for qid, ranking in query_results.items():
        scores = [entry["score"] for entry in ranking]
        for earlier, later in zip(scores, scores[1:]):
            assert earlier >= later, (
                f"Scores for {qid} must be non-increasing (descending rank); got {scores}."
            )


def test_seeded_top1_correctness(query_results, chunk_text_by_id):
    for qid, sentinel in SENTINELS.items():
        ranking = query_results[qid]
        assert ranking, f"Query {qid} returned no results."
        top1_id = ranking[0]["chunk_id"]
        assert top1_id in chunk_text_by_id, (
            f"Top-1 chunk_id {top1_id} for {qid} is not present in chunks.json."
        )
        top1_text = chunk_text_by_id[top1_id]
        assert sentinel in top1_text, (
            f"Top-1 chunk for query {qid} must contain the answer marker '{sentinel}'. "
            f"Got chunk_id {top1_id} with text: {top1_text[:200]!r}"
        )


def test_live_query_interface(built_pipeline, chunk_text_by_id):
    result = subprocess.run(
        ["python3", "main.py", "--query", "which currency settles invoices", "--top-k", "3"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RESULT_TIMEOUT,
    )
    assert result.returncode == 0, (
        "`python3 main.py --query ...` failed with return code "
        f"{result.returncode}.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )

    stdout = result.stdout.strip()
    try:
        ranking = json.loads(stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(f"stdout of --query must be a single JSON array; got: {result.stdout!r} ({exc})")

    assert isinstance(ranking, list), "The --query output must be a JSON array."
    assert 1 <= len(ranking) <= 3, f"Expected at most 3 results for --top-k 3; got {len(ranking)}."

    scores = []
    for entry in ranking:
        assert isinstance(entry, dict), "Each --query result must be a JSON object."
        assert set(entry.keys()) == {"chunk_id", "score"}, (
            f"Each --query result must have exactly the keys 'chunk_id' and 'score'; got {set(entry.keys())}."
        )
        assert isinstance(entry["chunk_id"], int) and not isinstance(entry["chunk_id"], bool), (
            "chunk_id in --query output must be an integer."
        )
        assert _is_number(entry["score"]), "score in --query output must be a number."
        scores.append(entry["score"])

    for earlier, later in zip(scores, scores[1:]):
        assert earlier >= later, f"--query scores must be non-increasing; got {scores}."

    top1_id = ranking[0]["chunk_id"]
    assert top1_id in chunk_text_by_id, (
        f"Top-1 chunk_id {top1_id} from --query is not present in chunks.json."
    )
    assert "kronelumen" in chunk_text_by_id[top1_id], (
        "The live query 'which currency settles invoices' must return the billing chunk "
        f"(containing 'kronelumen') as top-1; got chunk_id {top1_id}."
    )
