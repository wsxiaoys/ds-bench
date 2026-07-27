#!/usr/bin/env python3
"""Offline BM25 lexical retrieval pipeline over a Docling-parsed document.

This script builds a classical BM25 index over structurally-aligned,
contextualized chunks extracted from a PDF via the Docling library, and
exposes a query interface. Everything runs fully offline: no models are
downloaded and no neural/embedding similarity is used.
"""

import argparse
import json
import math
import os
import pickle
import re
import sys
from collections import Counter

from docling.document_converter import DocumentConverter
from docling_core.types.doc.document import DocItemLabel

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(PROJECT_ROOT, "assets", "report.pdf")
QUERIES_PATH = os.path.join(PROJECT_ROOT, "assets", "queries.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")
CHUNKS_PATH = os.path.join(OUTPUT_DIR, "chunks.json")
INDEX_PATH = os.path.join(OUTPUT_DIR, "bm25_index.idx")

# ---------------------------------------------------------------------------
# BM25 parameters (Okapi BM25)
# ---------------------------------------------------------------------------
K1 = 1.5
B = 0.75
DEFAULT_TOP_K = 5

# Labels that act as headings (structural delimiters, not content chunks).
HEADING_LABELS = {DocItemLabel.SECTION_HEADER, DocItemLabel.TITLE}

# Labels that are pure content and should become their own chunk.
CONTENT_LABELS = {
    DocItemLabel.TEXT,
    DocItemLabel.PARAGRAPH,
    DocItemLabel.LIST_ITEM,
    DocItemLabel.TABLE,
    DocItemLabel.CODE,
    DocItemLabel.CAPTION,
    DocItemLabel.FOOTNOTE,
    DocItemLabel.FORMULA,
}

# ---------------------------------------------------------------------------
# Tokenization
# ---------------------------------------------------------------------------
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    """Lowercase and split into alphanumeric lexical terms."""
    return _TOKEN_RE.findall((text or "").lower())


# ---------------------------------------------------------------------------
# Document conversion & structural chunking
# ---------------------------------------------------------------------------
def convert_pdf(pdf_path):
    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    if result.status.name != "SUCCESS":
        raise RuntimeError(f"Docling conversion failed: {result.status}")
    return result.document


def serialize_table(table_item):
    """Serialize a Docling TableItem into a verbatim text representation.

    Every cell's text appears verbatim. Rows are separated by newlines and
    cells within a row by ' | ' so the structure is recoverable while keeping
    each cell string intact.
    """
    data = table_item.data
    rows = []
    for row in data.grid:
        cell_texts = [cell.text for cell in row]
        rows.append(" | ".join(cell_texts))
    return "\n".join(rows)


def page_nos_of(item):
    """Return sorted, de-duplicated 1-based page numbers from provenance."""
    nos = set()
    for prov in getattr(item, "prov", []) or []:
        page_no = getattr(prov, "page_no", None)
        if page_no is not None:
            nos.add(int(page_no))
    return sorted(nos)


def heading_level(item):
    """Heading level for stack management (defaults to 1)."""
    lvl = getattr(item, "level", None)
    if lvl is None or lvl == 0:
        return 1
    return int(lvl)


def build_chunks(doc):
    """Produce a list of contextualized chunk dicts in document order.

    Headings (section headers / titles) are NOT emitted as standalone chunks;
    instead they maintain a hierarchical heading stack that becomes the
    ``heading_path`` of every following content chunk. This guarantees that a
    query matching only a section heading still retrieves that section's
    content chunk (the heading context is folded into the indexed text).
    """
    heading_stack = []  # list of (level, heading_text)
    chunks = []

    for item, _tree_level in doc.iterate_items():
        label = item.label

        if label in HEADING_LABELS:
            lvl = heading_level(item)
            text = (item.text or "").strip()
            if text:
                while heading_stack and heading_stack[-1][0] >= lvl:
                    heading_stack.pop()
                heading_stack.append((lvl, text))
            continue

        if label == DocItemLabel.TABLE:
            chunk_text = serialize_table(item)
        elif label in CONTENT_LABELS:
            chunk_text = (item.text or "").strip()
        else:
            # Unknown / non-content structural element: skip.
            continue

        if not chunk_text:
            continue

        heading_path = [h[1] for h in heading_stack]
        page_nos = page_nos_of(item)
        if not page_nos:
            # Fallback: attribute to all known pages.
            page_nos = sorted(int(p) for p in (doc.pages or {}).keys())

        chunks.append(
            {
                "chunk_id": len(chunks),
                "heading_path": heading_path,
                "page_nos": page_nos,
                "text": chunk_text,
            }
        )

    return chunks


def finalize_chunk_terms(chunks):
    """Attach token statistics (content + contextualized) to each chunk."""
    for chunk in chunks:
        content_tokens = tokenize(chunk["text"])
        chunk["term_count"] = len(content_tokens)
        # Contextualized text = heading path + content, used by the BM25 index
        # so heading context participates in lexical matching.
        contextualized = " ".join(chunk["heading_path"]) + " " + chunk["text"]
        chunk["_context_tokens"] = tokenize(contextualized)
        chunk["_context_len"] = len(chunk["_context_tokens"])
    return chunks


# ---------------------------------------------------------------------------
# BM25 index
# ---------------------------------------------------------------------------
def build_bm25_index(chunks):
    """Compute BM25 statistics over the contextualized chunk tokens."""
    n = len(chunks)
    df = Counter()
    for chunk in chunks:
        for term in set(chunk["_context_tokens"]):
            df[term] += 1

    # Okapi IDF with +1 smoothing to keep it non-negative.
    idf = {}
    for term, dfreq in df.items():
        idf[term] = math.log((n - dfreq + 0.5) / (dfreq + 0.5) + 1.0)

    avgdl = sum(chunk["_context_len"] for chunk in chunks) / n if n else 0.0

    index = {
        "k1": K1,
        "b": B,
        "n": n,
        "avgdl": avgdl,
        "df": dict(df),
        "idf": idf,
        "chunks": [
            {
                "chunk_id": chunk["chunk_id"],
                "tokens": chunk["_context_tokens"],
                "length": chunk["_context_len"],
            }
            for chunk in chunks
        ],
    }
    return index


def score_chunk(query_terms, chunk_entry, idf, avgdl, k1, b):
    """Okapi BM25 score of a single chunk for the given query terms."""
    score = 0.0
    if not chunk_entry["tokens"] or avgdl <= 0:
        return 0.0
    tf = Counter(chunk_entry["tokens"])
    dl = chunk_entry["length"]
    denom_norm = k1 * (1.0 - b + b * dl / avgdl)
    for term in query_terms:
        f = tf.get(term, 0)
        if f == 0:
            continue
        w = idf.get(term, 0.0)
        score += w * (f * (k1 + 1.0)) / (f + denom_norm)
    return score


def query_index(index, query, top_k=DEFAULT_TOP_K):
    """Return top-k (chunk_id, score) pairs ranked by descending BM25 score."""
    query_terms = tokenize(query)
    idf = index["idf"]
    avgdl = index["avgdl"]
    k1 = index["k1"]
    b = index["b"]

    scored = []
    for chunk_entry in index["chunks"]:
        s = score_chunk(query_terms, chunk_entry, idf, avgdl, k1, b)
        scored.append((chunk_entry["chunk_id"], s))

    # Sort by descending score, tie-break by chunk_id for determinism.
    scored.sort(key=lambda x: (-x[1], x[0]))
    return scored[:top_k]


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
def write_chunks(chunks):
    public_chunks = []
    for chunk in chunks:
        public_chunks.append(
            {
                "chunk_id": chunk["chunk_id"],
                "heading_path": chunk["heading_path"],
                "page_nos": chunk["page_nos"],
                "text": chunk["text"],
                "term_count": chunk["term_count"],
            }
        )
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(public_chunks, f, ensure_ascii=False, indent=2)


def save_index(index):
    with open(INDEX_PATH, "wb") as f:
        pickle.dump(index, f)


def load_index():
    with open(INDEX_PATH, "rb") as f:
        return pickle.load(f)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
def cmd_build():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Converting PDF with Docling...", file=sys.stderr)
    doc = convert_pdf(PDF_PATH)
    chunks = build_chunks(doc)
    if not chunks:
        raise RuntimeError("No chunks produced from the document.")
    chunks = finalize_chunk_terms(chunks)

    write_chunks(chunks)
    index = build_bm25_index(chunks)
    save_index(index)

    print(
        f"Built {len(chunks)} chunks -> {CHUNKS_PATH}",
        file=sys.stderr,
    )
    print(f"BM25 index persisted -> {INDEX_PATH}", file=sys.stderr)


def cmd_query(query, top_k):
    index = load_index()
    results = query_index(index, query, top_k=top_k)
    output = [{"chunk_id": cid, "score": score} for cid, score in results]
    print(json.dumps(output, ensure_ascii=False))


def cmd_run_queries():
    index = load_index()
    with open(QUERIES_PATH, "r", encoding="utf-8") as f:
        queries = json.load(f)

    results = {}
    for entry in queries:
        qid = entry["query_id"]
        query = entry["query"]
        ranked = query_index(index, query, top_k=DEFAULT_TOP_K)
        results[qid] = [{"chunk_id": cid, "score": score} for cid, score in ranked]

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, "query_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Query results written -> {out_path}", file=sys.stderr)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Offline BM25 retrieval over a Docling-parsed document."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--build", action="store_true", help="Build the index.")
    group.add_argument("--query", metavar="TEXT", help="Query the index.")
    group.add_argument(
        "--run-queries", action="store_true", help="Run the seeded queries."
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help="Number of results to return (default 5).",
    )
    args = parser.parse_args()

    if args.build:
        cmd_build()
    elif args.query:
        cmd_query(args.query, args.top_k)
    elif args.run_queries:
        cmd_run_queries()


if __name__ == "__main__":
    main()