#!/usr/bin/env python3
"""Fully-offline local RAG index over Docling chunks.

Two subcommands:

  index  - Convert every *.pdf in a documents directory with Docling, chunk each
           converted document into heading-aware, context-enriched chunks and
           persist them into a single on-disk SQLite index file.

  query  - Load the on-disk index and return the top-K chunks most relevant to a
           free-text query, scored with a local, deterministic BM25 measure.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def _positive_int(value: str) -> int:
    try:
        ivalue = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"invalid int value: {value!r}") from exc
    if ivalue < 1:
        raise argparse.ArgumentTypeError("--top-k must be >= 1")
    return ivalue


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="main.py")
    subparsers = parser.add_subparsers(dest="command", required=True)

    index_parser = subparsers.add_parser("index")
    index_parser.add_argument("--docs", required=True, help="Directory containing *.pdf files")
    index_parser.add_argument("--index", required=True, help="Path to the on-disk SQLite index file")

    query_parser = subparsers.add_parser("query")
    query_parser.add_argument("--index", required=True, help="Path to the on-disk SQLite index file")
    query_parser.add_argument("--query", required=True, help="Free-text query string")
    query_parser.add_argument("--top-k", type=_positive_int, required=True, dest="top_k")

    return parser


# ---------------------------------------------------------------------------
# Chunking (Docling)
# ---------------------------------------------------------------------------


def _extract_page(chunk: Any) -> int:
    """Return the 1-based page number the chunk's content originates from."""
    for item in chunk.meta.doc_items:
        prov = getattr(item, "prov", None)
        if prov:
            return int(prov[0].page_no)
    return 1


def _extract_heading_path(chunk: Any) -> list[str]:
    headings = chunk.meta.headings
    if not headings:
        return []
    return [str(h) for h in headings]


def convert_and_chunk(pdf_path: Path) -> list[dict[str, Any]]:
    """Convert a single PDF with Docling and produce heading-aware, context-enriched chunks."""
    # Imported lazily so that argument-parsing / validation errors (exit codes
    # 2/3/4) don't pay the cost of importing docling's heavy dependencies.
    from docling.document_converter import DocumentConverter
    from docling.chunking import HierarchicalChunker

    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    doc = result.document

    chunker = HierarchicalChunker()
    records = []
    for chunk in chunker.chunk(doc):
        text = chunker.contextualize(chunk=chunk)
        records.append(
            {
                "source": pdf_path.name,
                "page": _extract_page(chunk),
                "heading_path": _extract_heading_path(chunk),
                "text": text,
            }
        )
    return records


# ---------------------------------------------------------------------------
# Index storage (SQLite)
# ---------------------------------------------------------------------------


def _connect(index_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(index_path))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            chunk_id INTEGER PRIMARY KEY,
            source TEXT NOT NULL,
            page INTEGER NOT NULL,
            heading_path TEXT NOT NULL,
            text TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def run_index(docs_dir: str, index_path_str: str) -> int:
    docs_path = Path(docs_dir)
    if not docs_path.is_dir():
        print(f"error: documents directory does not exist: {docs_dir}", file=sys.stderr)
        return 3

    pdf_files = sorted(docs_path.glob("*.pdf"), key=lambda p: p.name)
    if not pdf_files:
        print(f"error: no *.pdf files found in: {docs_dir}", file=sys.stderr)
        return 3

    index_path = Path(index_path_str)
    index_path.parent.mkdir(parents=True, exist_ok=True)

    all_records: list[dict[str, Any]] = []
    for pdf_path in pdf_files:
        all_records.extend(convert_and_chunk(pdf_path))

    conn = _connect(index_path)
    try:
        # Idempotency: a run of `index` fully replaces the table contents with
        # a freshly (deterministically) computed chunk set, so re-running on
        # the same documents never accumulates duplicates.
        conn.execute("DELETE FROM chunks")
        conn.executemany(
            "INSERT INTO chunks (source, page, heading_path, text) VALUES (?, ?, ?, ?)",
            [
                (
                    rec["source"],
                    rec["page"],
                    json.dumps(rec["heading_path"]),
                    rec["text"],
                )
                for rec in all_records
            ],
        )
        conn.commit()
    finally:
        conn.close()

    print(json.dumps({"documents": len(pdf_files), "chunks": len(all_records)}))
    return 0


# ---------------------------------------------------------------------------
# Query / scoring (local, deterministic BM25)
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"\w+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _bm25_scores(
    rows: list[sqlite3.Row], query_tokens: list[str], k1: float = 1.5, b: float = 0.75
) -> dict[int, float]:
    n_docs = len(rows)
    scores: dict[int, float] = {row["chunk_id"]: 0.0 for row in rows}
    if n_docs == 0 or not query_tokens:
        return scores

    doc_tokens: dict[int, list[str]] = {row["chunk_id"]: _tokenize(row["text"]) for row in rows}
    doc_len: dict[int, int] = {cid: len(toks) for cid, toks in doc_tokens.items()}
    total_len = sum(doc_len.values())
    avgdl = (total_len / n_docs) if n_docs else 0.0

    doc_freq: dict[str, int] = {}
    unique_query_terms = set(query_tokens)
    for toks in doc_tokens.values():
        toks_set = set(toks)
        for term in unique_query_terms:
            if term in toks_set:
                doc_freq[term] = doc_freq.get(term, 0) + 1

    for cid, toks in doc_tokens.items():
        if not toks:
            continue
        term_freq: dict[str, int] = {}
        for t in toks:
            term_freq[t] = term_freq.get(t, 0) + 1

        dl = doc_len[cid]
        score = 0.0
        for term in unique_query_terms:
            freq = term_freq.get(term, 0)
            if freq == 0:
                continue
            n_q = doc_freq.get(term, 0)
            idf = math.log((n_docs - n_q + 0.5) / (n_q + 0.5) + 1.0)
            denom = freq + k1 * (1.0 - b + b * (dl / avgdl if avgdl > 0 else 1.0))
            score += idf * (freq * (k1 + 1.0)) / denom
        scores[cid] = score

    return scores


def run_query(index_path_str: str, query: str, top_k: int) -> int:
    index_path = Path(index_path_str)
    if not index_path.is_file():
        print(f"error: index file does not exist: {index_path_str}", file=sys.stderr)
        return 4

    conn = sqlite3.connect(str(index_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT chunk_id, source, page, heading_path, text FROM chunks"
        ).fetchall()
    finally:
        conn.close()

    query_tokens = _tokenize(query)
    scores = _bm25_scores(rows, query_tokens)

    ranked = sorted(rows, key=lambda row: (-scores[row["chunk_id"]], row["chunk_id"]))
    top_rows = ranked[:top_k]

    results = []
    for row in top_rows:
        results.append(
            {
                "text": row["text"],
                "source": row["source"],
                "page": int(row["page"]),
                "heading_path": json.loads(row["heading_path"]),
                "score": scores[row["chunk_id"]],
            }
        )

    print(json.dumps(results))
    return 0


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "index":
        return run_index(args.docs, args.index)
    elif args.command == "query":
        return run_query(args.index, args.query, args.top_k)
    else:
        # Unreachable: argparse enforces valid subcommands via `required=True`
        # and the fixed choice set of registered subparsers.
        parser.error(f"unknown command: {args.command}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
