#!/usr/bin/env python3
"""
Offline BM25 retrieval pipeline over a Docling-parsed document.

Commands:
    python3 main.py --build
    python3 main.py --query "<text>" [--top-k <k>]
    python3 main.py --run-queries
"""

import argparse
import json
import pickle
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
ASSETS_DIR = PROJECT_ROOT / "assets"
OUTPUT_DIR = PROJECT_ROOT / "output"

PDF_PATH = ASSETS_DIR / "report.pdf"
QUERIES_PATH = ASSETS_DIR / "queries.json"

CHUNKS_PATH = OUTPUT_DIR / "chunks.json"
INDEX_PATH = OUTPUT_DIR / "bm25_index.idx"
RESULTS_PATH = OUTPUT_DIR / "query_results.json"

DEFAULT_TOP_K = 5

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str):
    """Simple, deterministic lexical tokenizer: lowercase alphanumeric terms."""
    return _TOKEN_RE.findall(text.lower())


def build_contextualized_text(heading_path, text):
    """Combine the heading path with the chunk body so that queries matching
    only a section heading still retrieve the chunk during BM25 scoring."""
    return " ".join(heading_path + [text])


def convert_and_chunk(pdf_path: Path):
    """Convert the PDF with docling and split it into structurally-aligned
    chunks, one per detected structural element (docling's own
    HierarchicalChunker), preserving heading context and page provenance."""
    from docling.document_converter import DocumentConverter
    from docling.chunking import HierarchicalChunker

    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    doc = result.document

    chunker = HierarchicalChunker()
    raw_chunks = list(chunker.chunk(doc))

    chunks = []
    for idx, chunk in enumerate(raw_chunks):
        heading_path = list(chunk.meta.headings) if chunk.meta.headings else []

        page_nos = set()
        for doc_item in chunk.meta.doc_items:
            for prov in doc_item.prov:
                if prov.page_no is not None:
                    page_nos.add(int(prov.page_no))
        page_nos = sorted(page_nos)

        text = chunk.text

        contextualized_text = build_contextualized_text(heading_path, text)
        term_count = len(tokenize(contextualized_text))

        chunks.append(
            {
                "chunk_id": idx,
                "heading_path": heading_path,
                "page_nos": page_nos,
                "text": text,
                "term_count": term_count,
            }
        )

    return chunks


def build_index():
    from rank_bm25 import BM25Okapi

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    chunks = convert_and_chunk(PDF_PATH)

    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    tokenized_corpus = [
        tokenize(build_contextualized_text(c["heading_path"], c["text"])) for c in chunks
    ]
    chunk_ids = [c["chunk_id"] for c in chunks]

    bm25 = BM25Okapi(tokenized_corpus)

    index_payload = {
        "bm25": bm25,
        "chunk_ids": chunk_ids,
    }
    with open(INDEX_PATH, "wb") as f:
        pickle.dump(index_payload, f)

    print(
        f"Built index over {len(chunks)} chunks -> {CHUNKS_PATH} , {INDEX_PATH}",
        file=sys.stderr,
    )


def load_index():
    with open(INDEX_PATH, "rb") as f:
        payload = pickle.load(f)
    return payload["bm25"], payload["chunk_ids"]


def query_index(query_text: str, top_k: int = DEFAULT_TOP_K):
    bm25, chunk_ids = load_index()

    tokenized_query = tokenize(query_text)
    scores = bm25.get_scores(tokenized_query)

    ranked = sorted(
        zip(chunk_ids, scores), key=lambda pair: pair[1], reverse=True
    )
    top = ranked[:top_k]

    return [{"chunk_id": int(cid), "score": float(score)} for cid, score in top]


def run_seeded_queries():
    with open(QUERIES_PATH, "r", encoding="utf-8") as f:
        queries = json.load(f)

    results = {}
    for item in queries:
        query_id = item["query_id"]
        query_text = item["query"]
        results[query_id] = query_index(query_text, top_k=DEFAULT_TOP_K)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"Wrote seeded query results -> {RESULTS_PATH}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Offline BM25 retrieval over a docling-parsed PDF.")
    parser.add_argument("--build", action="store_true", help="Convert the PDF and build the BM25 index.")
    parser.add_argument("--query", type=str, default=None, help="Run a single query against the persisted index.")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K, help="Number of results to return.")
    parser.add_argument("--run-queries", action="store_true", help="Evaluate all seeded queries.")

    args = parser.parse_args()

    if args.build:
        build_index()
    elif args.query is not None:
        results = query_index(args.query, top_k=args.top_k)
        print(json.dumps(results))
    elif args.run_queries:
        run_seeded_queries()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
