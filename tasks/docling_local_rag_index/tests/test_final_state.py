import json
import os
import sqlite3
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
MAIN = "main.py"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")
INDEX_PATH = os.path.join(PROJECT_DIR, "index.db")

INDEX_TIMEOUT = 1800
QUERY_TIMEOUT = 600


def _run(args, timeout):
    """Run `python main.py <args>` inside the project dir with the inherited (offline) env."""
    env = os.environ.copy()
    return subprocess.run(
        ["python", MAIN, *args],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=env,
        timeout=timeout,
    )


def _extract_json(text):
    """Robustly extract the last JSON value printed on stdout.

    The program is required to print a single JSON value; but to be tolerant of
    any incidental logging we try a full parse first, then a per-line scan from
    the bottom, then a bracket-slice fallback.
    """
    text = text.strip()
    if text:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        for line in reversed(text.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        for opener, closer in (("[", "]"), ("{", "}")):
            start = text.find(opener)
            end = text.rfind(closer)
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    continue
    raise AssertionError(f"Could not parse JSON from output:\n{text}")


def _count_chunks():
    conn = sqlite3.connect(INDEX_PATH)
    try:
        cur = conn.execute("SELECT COUNT(*) FROM chunks")
        return cur.fetchone()[0]
    finally:
        conn.close()


def _query(query_string, top_k):
    result = _run(
        ["query", "--index", INDEX_PATH, "--query", query_string, "--top-k", str(top_k)],
        QUERY_TIMEOUT,
    )
    assert result.returncode == 0, (
        f"query for {query_string!r} exited {result.returncode}. stderr:\n{result.stderr}"
    )
    data = _extract_json(result.stdout)
    assert isinstance(data, list), f"query output must be a JSON array, got: {type(data)}"
    return data


@pytest.fixture(scope="session")
def build_index():
    if os.path.isfile(INDEX_PATH):
        os.remove(INDEX_PATH)
    result = _run(["index", "--docs", CORPUS_DIR, "--index", INDEX_PATH], INDEX_TIMEOUT)
    assert result.returncode == 0, (
        f"index command failed with exit code {result.returncode}. stderr:\n{result.stderr}"
    )
    summary = _extract_json(result.stdout)
    assert isinstance(summary, dict), "index must print a single JSON object to stdout."
    assert os.path.isfile(INDEX_PATH), f"index file {INDEX_PATH} was not created."
    return summary


def _assert_result_schema(obj):
    assert isinstance(obj, dict), f"each result must be an object, got {type(obj)}"
    assert set(obj.keys()) == {"text", "source", "page", "heading_path", "score"}, (
        f"result object must have exactly keys text/source/page/heading_path/score, got {sorted(obj.keys())}"
    )
    assert isinstance(obj["text"], str), "'text' must be a string"
    assert isinstance(obj["source"], str), "'source' must be a string"
    assert isinstance(obj["page"], int), "'page' must be an integer"
    assert isinstance(obj["heading_path"], list), "'heading_path' must be an array"
    assert all(isinstance(h, str) for h in obj["heading_path"]), "'heading_path' must be strings"
    assert isinstance(obj["score"], (int, float)) and not isinstance(obj["score"], bool), (
        "'score' must be a number"
    )


def test_index_summary_and_db_structure(build_index):
    summary = build_index
    assert summary.get("documents") == 3, (
        f"expected 'documents' == 3 (three PDFs in corpus), got {summary.get('documents')}"
    )
    assert isinstance(summary.get("chunks"), int) and summary["chunks"] > 3, (
        f"expected 'chunks' to be an int > 3, got {summary.get('chunks')}"
    )

    conn = sqlite3.connect(INDEX_PATH)
    try:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(chunks)").fetchall()}
        assert {"chunk_id", "source", "page", "heading_path", "text"}.issubset(cols), (
            f"chunks table must contain the required columns, got {sorted(cols)}"
        )
        rows = conn.execute("SELECT source, page, heading_path FROM chunks").fetchall()
    finally:
        conn.close()

    assert len(rows) == summary["chunks"], (
        "row count in chunks table must equal the reported 'chunks' total."
    )
    valid_sources = {"climate.pdf", "robotics.pdf", "finance.pdf"}
    for source, page, heading_path in rows:
        assert source in valid_sources, f"unexpected source {source!r} in chunks table"
        assert isinstance(page, int) and page >= 1, f"page must be a positive int, got {page!r}"
        parsed = json.loads(heading_path)
        assert isinstance(parsed, list) and all(isinstance(h, str) for h in parsed), (
            f"heading_path must be a JSON array of strings, got {heading_path!r}"
        )


def test_query_marker_climate_page1(build_index):
    results = _query("ZORPHENOL4471", 3)
    assert 1 <= len(results) <= 3, f"expected 1..3 results, got {len(results)}"
    for obj in results:
        _assert_result_schema(obj)
    top = results[0]
    assert "ZORPHENOL4471" in top["text"], f"top chunk must contain the marker, got: {top['text']!r}"
    assert top["source"] == "climate.pdf", f"expected source climate.pdf, got {top['source']!r}"
    assert top["page"] == 1, f"expected page 1, got {top['page']}"


def test_query_marker_climate_page2(build_index):
    results = _query("THALASSO9920", 3)
    assert len(results) >= 1, "expected at least one result"
    top = results[0]
    _assert_result_schema(top)
    assert "THALASSO9920" in top["text"], f"top chunk must contain the marker, got: {top['text']!r}"
    assert top["source"] == "climate.pdf", f"expected source climate.pdf, got {top['source']!r}"
    assert top["page"] == 2, f"expected page 2, got {top['page']}"


def test_query_marker_robotics_page2(build_index):
    results = _query("SENSORIA6613", 3)
    assert len(results) >= 1, "expected at least one result"
    top = results[0]
    _assert_result_schema(top)
    assert "SENSORIA6613" in top["text"], f"top chunk must contain the marker, got: {top['text']!r}"
    assert top["source"] == "robotics.pdf", f"expected source robotics.pdf, got {top['source']!r}"
    assert top["page"] == 2, f"expected page 2, got {top['page']}"


def test_query_table_row_carries_header_context(build_index):
    results = _query("VECTORBOND5501", 3)
    assert len(results) >= 1, "expected at least one result"
    top = results[0]
    _assert_result_schema(top)
    assert "VECTORBOND5501" in top["text"], (
        f"top chunk must contain the table row keyword, got: {top['text']!r}"
    )
    assert "Codename" in top["text"], (
        "top chunk for a table-row keyword must also carry the table's column/header "
        f"context (the 'Codename' header), got: {top['text']!r}"
    )
    assert top["source"] == "finance.pdf", f"expected source finance.pdf, got {top['source']!r}"
    assert top["page"] == 2, f"expected page 2, got {top['page']}"


def test_query_ordering_and_topk_bound(build_index):
    results = _query("FINLIQ7745", 2)
    assert len(results) <= 2, f"top-k=2 must return at most 2 results, got {len(results)}"
    assert len(results) >= 1, "expected at least one result"
    for obj in results:
        _assert_result_schema(obj)
    scores = [obj["score"] for obj in results]
    assert scores == sorted(scores, reverse=True), (
        f"results must be ordered by descending score, got {scores}"
    )
    top = results[0]
    assert "FINLIQ7745" in top["text"], f"top chunk must contain the marker, got: {top['text']!r}"
    assert top["source"] == "finance.pdf", f"expected source finance.pdf, got {top['source']!r}"
    assert top["page"] == 1, f"expected page 1, got {top['page']}"


def test_reindex_is_idempotent(build_index):
    before = _count_chunks()
    result = _run(["index", "--docs", CORPUS_DIR, "--index", INDEX_PATH], INDEX_TIMEOUT)
    assert result.returncode == 0, (
        f"second index run failed with exit code {result.returncode}. stderr:\n{result.stderr}"
    )
    after = _count_chunks()
    assert after == before, (
        f"re-indexing must be idempotent: chunk count changed from {before} to {after}"
    )


def test_query_missing_index_exit_code(build_index):
    missing = os.path.join(PROJECT_DIR, "does_not_exist.db")
    if os.path.isfile(missing):
        os.remove(missing)
    result = _run(["query", "--index", missing, "--query", "x", "--top-k", "1"], QUERY_TIMEOUT)
    assert result.returncode == 4, (
        f"query on a missing index must exit with code 4, got {result.returncode}. stderr:\n{result.stderr}"
    )


def test_index_no_pdfs_exit_code(build_index):
    empty_dir = os.path.join(PROJECT_DIR, "empty_dir")
    os.makedirs(empty_dir, exist_ok=True)
    for name in os.listdir(empty_dir):
        os.remove(os.path.join(empty_dir, name))
    out_index = os.path.join(PROJECT_DIR, "index_empty.db")
    if os.path.isfile(out_index):
        os.remove(out_index)
    result = _run(["index", "--docs", empty_dir, "--index", out_index], QUERY_TIMEOUT)
    assert result.returncode == 3, (
        f"indexing a directory with no PDFs must exit with code 3, got {result.returncode}. stderr:\n{result.stderr}"
    )


def test_query_invalid_topk_exit_code(build_index):
    result = _run(["query", "--index", INDEX_PATH, "--query", "x", "--top-k", "0"], QUERY_TIMEOUT)
    assert result.returncode == 2, (
        f"query with --top-k 0 must exit with code 2, got {result.returncode}. stderr:\n{result.stderr}"
    )
