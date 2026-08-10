#!/usr/bin/env python3
"""
Offline BM25 Retrieval Index over a Docling-Parsed Document.

Build:  python3 main.py --build
Query:  python3 main.py --query "<text>" [--top-k <k>]
Run:    python3 main.py --run-queries
"""

import argparse
import json
import math
import os
import re
import sys

import numpy as np
from docling.document_converter import DocumentConverter


# ---------------------------------------------------------------------------
# Tokenizer (simple whitespace + punctuation split, no external dependencies)
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric, drop empty tokens."""
    return [t for t in re.split(r"[^a-zA-Z0-9]+", text.lower()) if t]


def term_count(text: str) -> int:
    return len(tokenize(text))


# ---------------------------------------------------------------------------
# Document parsing & chunking
# ---------------------------------------------------------------------------

def extract_table_text(table_item) -> str:
    """Extract cell content verbatim from a Docling TableItem."""
    cells = table_item.data.table_cells
    # Group cells by row
    rows: dict[int, list[str]] = {}
    for cell in cells:
        row_idx = cell.start_row_offset_idx
        rows.setdefault(row_idx, []).append(cell.text)
    # Emit one line per row with cell texts separated by " | "
    lines = []
    for row_idx in sorted(rows.keys()):
        lines.append(" | ".join(rows[row_idx]))
    return "\n".join(lines)


def build_chunks(pdf_path: str) -> list[dict]:
    """
    Convert PDF via Docling, segment into structurally-aligned chunks,
    enrich with heading_path and page_nos.
    """
    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    doc = result.document

    chunks: list[dict] = []
    heading_stack: list[str] = []  # current hierarchical heading path

    for item, level in doc.iterate_items():
        label = item.label.value  # e.g. "section_header", "text", "table"

        # --- Update heading stack ---
        if label == "section_header":
            # Pop headings at same or deeper level
            while len(heading_stack) >= level:
                heading_stack.pop()
            heading_stack.append(item.text)
            # Heading items become their own chunks
            text = item.text
            page_nos = sorted(set(p.page_no for p in item.prov)) if item.prov else [1]
            chunks.append({
                "chunk_id": len(chunks),
                "heading_path": list(heading_stack[:-1]),  # path *before* this heading
                "page_nos": page_nos,
                "text": text,
                "term_count": term_count(text),
            })
            continue

        # --- Text / Table items ---
        if label == "text":
            text = item.text
            page_nos = sorted(set(p.page_no for p in item.prov)) if item.prov else [1]
        elif label == "table":
            text = extract_table_text(item)
            page_nos = sorted(set(p.page_no for p in item.prov)) if item.prov else [1]
        else:
            continue  # skip unknown types

        chunks.append({
            "chunk_id": len(chunks),
            "heading_path": list(heading_stack),
            "page_nos": page_nos,
            "text": text,
            "term_count": term_count(text),
        })

    return chunks


# ---------------------------------------------------------------------------
# BM25 index (custom, self-contained, pickle-able)
# ---------------------------------------------------------------------------

class BM25Index:
    """
    Self-contained BM25 index that can be pickled and reloaded.
    Uses the ATIRE BM25 variant (same as rank_bm25.BM25Okapi).

    The index is persisted as a JSON-serializable dict so it can be loaded
    in any process without needing the class definition at pickle time.
    """

    def __init__(self, k1=1.5, b=0.75, epsilon=0.25):
        self.k1 = k1
        self.b = b
        self.epsilon = epsilon
        # To be populated by build() or load()
        self.corpus_size = 0
        self.avgdl = 0.0
        self.doc_len: list[int] = []
        self.doc_freqs: list[dict[str, int]] = []
        self.idf: dict[str, float] = {}
        self.average_idf = 0.0
        self._built = False

    def build(self, tokenized_docs: list[list[str]]):
        """Build the index from a list of tokenized documents."""
        self.corpus_size = 0
        self.doc_len = []
        self.doc_freqs = []
        self.idf = {}
        nd: dict[str, int] = {}  # word -> number of docs containing it
        total_tokens = 0

        for doc_tokens in tokenized_docs:
            self.doc_len.append(len(doc_tokens))
            total_tokens += len(doc_tokens)
            freqs: dict[str, int] = {}
            for w in doc_tokens:
                freqs[w] = freqs.get(w, 0) + 1
            self.doc_freqs.append(freqs)
            for w in freqs:
                nd[w] = nd.get(w, 0) + 1
            self.corpus_size += 1

        self.avgdl = total_tokens / max(1, self.corpus_size)

        # Compute IDF (ATIRE variant with epsilon floor)
        idf_sum = 0.0
        negative_idfs: list[str] = []
        for word, freq in nd.items():
            idf_val = math.log(self.corpus_size - freq + 0.5) - math.log(freq + 0.5)
            self.idf[word] = idf_val
            idf_sum += idf_val
            if idf_val < 0:
                negative_idfs.append(word)
        self.average_idf = idf_sum / max(1, len(self.idf))
        eps = self.epsilon * self.average_idf
        for word in negative_idfs:
            self.idf[word] = eps

        self._built = True

    def to_dict(self) -> dict:
        """Serialize index state to a plain dict (JSON-serializable)."""
        return {
            "k1": self.k1,
            "b": self.b,
            "epsilon": self.epsilon,
            "corpus_size": self.corpus_size,
            "avgdl": self.avgdl,
            "doc_len": self.doc_len,
            "doc_freqs": self.doc_freqs,
            "idf": self.idf,
            "average_idf": self.average_idf,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "BM25Index":
        """Restore index from a plain dict."""
        idx = cls(k1=d["k1"], b=d["b"], epsilon=d["epsilon"])
        idx.corpus_size = d["corpus_size"]
        idx.avgdl = d["avgdl"]
        idx.doc_len = d["doc_len"]
        idx.doc_freqs = d["doc_freqs"]
        idx.idf = d["idf"]
        idx.average_idf = d["average_idf"]
        idx._built = True
        return idx

    def get_scores(self, query_tokens: list[str]) -> np.ndarray:
        """Return BM25 score for each document (numpy array)."""
        if not self._built:
            raise RuntimeError("Index not built")
        scores = np.zeros(self.corpus_size)
        doc_len_arr = np.array(self.doc_len)
        for q in query_tokens:
            q_freq = np.array([doc.get(q, 0) for doc in self.doc_freqs])
            idf_q = self.idf.get(q, 0.0)
            scores += idf_q * (
                q_freq * (self.k1 + 1)
                / (q_freq + self.k1 * (1 - self.b + self.b * doc_len_arr / self.avgdl))
            )
        return scores

    def top_k(self, query_tokens: list[str], k: int = 5) -> list[dict]:
        """Return top-k results as list of {chunk_id, score} sorted desc."""
        scores = self.get_scores(query_tokens)
        # Get indices of top-k (descending)
        if k >= self.corpus_size:
            top_indices = list(range(self.corpus_size))
        else:
            top_indices = np.argpartition(scores, -k)[-k:]
        top_indices = top_indices[np.argsort(-scores[top_indices])]
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                results.append({"chunk_id": int(idx), "score": float(scores[idx])})
        return results[:k]


# ---------------------------------------------------------------------------
# Indexed text: heading_path + text for richer retrieval
# ---------------------------------------------------------------------------

def make_indexed_text(chunk: dict) -> str:
    """Combine heading_path and text so heading-only queries match."""
    parts = list(chunk["heading_path"]) + [chunk["text"]]
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Build command
# ---------------------------------------------------------------------------

def cmd_build():
    pdf_path = "/home/user/project/assets/report.pdf"
    chunks_path = "/home/user/project/output/chunks.json"
    index_path = "/home/user/project/output/bm25_index.idx"

    os.makedirs("/home/user/project/output", exist_ok=True)

    # 1. Parse and chunk
    chunks = build_chunks(pdf_path)

    # 2. Write chunks.json
    with open(chunks_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(chunks)} chunks to {chunks_path}")

    # 3. Build BM25 index over contextualized text
    indexed_texts = [make_indexed_text(c) for c in chunks]
    tokenized = [tokenize(t) for t in indexed_texts]

    bm25 = BM25Index()
    bm25.build(tokenized)

    # 4. Persist index as JSON
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(bm25.to_dict(), f)
    print(f"Persisted BM25 index to {index_path}")


# ---------------------------------------------------------------------------
# Query command
# ---------------------------------------------------------------------------

def load_index():
    index_path = "/home/user/project/output/bm25_index.idx"
    with open(index_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return BM25Index.from_dict(data)


def cmd_query(query_text: str, top_k: int = 5):
    bm25 = load_index()
    query_tokens = tokenize(query_text)
    results = bm25.top_k(query_tokens, k=top_k)
    print(json.dumps(results, indent=2))


# ---------------------------------------------------------------------------
# Run-queries command
# ---------------------------------------------------------------------------

def cmd_run_queries():
    queries_path = "/home/user/project/assets/queries.json"
    results_path = "/home/user/project/output/query_results.json"

    with open(queries_path, "r", encoding="utf-8") as f:
        queries = json.load(f)

    bm25 = load_index()
    output: dict[str, list[dict]] = {}

    for entry in queries:
        qid = entry["query_id"]
        qtext = entry["query"]
        tokens = tokenize(qtext)
        results = bm25.top_k(tokens, k=5)
        output[qid] = results

    os.makedirs("/home/user/project/output", exist_ok=True)
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Wrote query results to {results_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="BM25 Retrieval over Docling-parsed PDF")
    parser.add_argument("--build", action="store_true", help="Build chunks and BM25 index")
    parser.add_argument("--query", type=str, default=None, help="Query text")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results (default 5)")
    parser.add_argument("--run-queries", action="store_true", help="Run seeded queries")
    args = parser.parse_args()

    if args.build:
        cmd_build()
    elif args.run_queries:
        cmd_run_queries()
    elif args.query is not None:
        cmd_query(args.query, args.top_k)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
