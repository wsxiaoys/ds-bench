"""
PDF Ingestion & Semantic Search with LanceDB.

Reads PDFs from /app/corpus/, chunks and embeds their text with the OpenAI
Embeddings API, persists the chunks in a LanceDB table, and exposes a
``search(query, k)`` function that returns the most semantically similar chunks.
"""

from __future__ import annotations

import os
import glob
import time
from typing import List, Dict

import lancedb
import pypdf
from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CORPUS_DIR = "/app/corpus"
LANCEDB_DIR = "/home/user/myproject/lancedb"
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536  # dimension of text-embedding-3-small

# Chunking parameters
CHUNK_SIZE = 500      # characters per chunk
CHUNK_OVERLAP = 100   # overlap between consecutive chunks


def _get_run_id() -> str:
    """Return the run-id used to namespace the table name."""
    try:
        with open("/logs/artifacts/run-id", "r") as fh:
            return fh.read().strip()
    except OSError:
        return os.environ.get("RUN_ID", "default")


RUN_ID = _get_run_id()
TABLE_NAME = f"pdf_chunks_{RUN_ID}"


def _make_client() -> OpenAI:
    """Create an OpenAI client honouring OPENAI_BASE_URL if set."""
    kwargs = {"api_key": os.environ["OPENAI_API_KEY"]}
    base_url = os.environ.get("OPENAI_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


CLIENT = _make_client()


# ---------------------------------------------------------------------------
# Embedding helper (with simple retry + batching)
# ---------------------------------------------------------------------------
def _embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a list of texts using the OpenAI Embeddings API."""
    if not texts:
        return []
    # OpenAI allows up to 2048 inputs per request; batch to be safe.
    BATCH = 256
    all_vectors: List[List[float]] = []
    for start in range(0, len(texts), BATCH):
        batch = texts[start:start + BATCH]
        for attempt in range(5):
            try:
                resp = CLIENT.embeddings.create(
                    model=EMBEDDING_MODEL, input=batch
                )
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 4:
                    raise
                wait = 2 ** attempt
                print(f"Embedding request failed ({exc}); retrying in {wait}s")
                time.sleep(wait)
        all_vectors.extend(
            [d.embedding for d in sorted(resp.data, key=lambda x: x.index)]
        )
    return all_vectors


# ---------------------------------------------------------------------------
# PDF ingestion
# ---------------------------------------------------------------------------
def _extract_pages(pdf_path: str) -> List[str]:
    """Return a list of page-text strings (1-based index via position)."""
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return pages


def _chunk_text(text: str) -> List[str]:
    """Split *text* into overlapping character chunks."""
    chunks: List[str] = []
    if not text:
        return chunks
    step = CHUNK_SIZE - CHUNK_OVERLAP
    for start in range(0, len(text), step):
        chunk = text[start:start + CHUNK_SIZE]
        if chunk:
            chunks.append(chunk)
        if start + CHUNK_SIZE >= len(text):
            break
    return chunks


def ingest() -> str:
    """Read PDFs, chunk, embed, and persist into LanceDB.

    Returns the name of the table that was created / opened.
    """
    pdf_files = sorted(glob.glob(os.path.join(CORPUS_DIR, "*.pdf")))
    if not pdf_files:
        raise FileNotFoundError(f"No PDF files found in {CORPUS_DIR}")

    rows: List[Dict] = []
    for pdf_path in pdf_files:
        doc_id = os.path.splitext(os.path.basename(pdf_path))[0]
        pages = _extract_pages(pdf_path)
        for page_idx, page_text in enumerate(pages, start=1):
            chunks = _chunk_text(page_text)
            for chunk_idx, chunk in enumerate(chunks):
                rows.append({
                    "doc_id": doc_id,
                    "page": page_idx,
                    "chunk_id": chunk_idx,
                    "text": chunk,
                    # placeholder; filled after embedding
                    "embedding": None,
                })

    # Embed all chunk texts in one go.
    texts = [r["text"] for r in rows]
    embeddings = _embed_texts(texts)
    for r, emb in zip(rows, embeddings):
        r["embedding"] = emb

    # Connect to LanceDB and create / replace the table (idempotent).
    db = lancedb.connect(LANCEDB_DIR)
    try:
        db.drop_table(TABLE_NAME)
    except Exception:
        pass  # table may not exist yet
    table = db.create_table(TABLE_NAME, rows)
    print(
        f"Ingested {len(rows)} chunks from {len(pdf_files)} PDFs into "
        f"table '{TABLE_NAME}' at {LANCEDB_DIR}"
    )
    return TABLE_NAME


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
def search(query: str, k: int) -> List[Dict]:
    """Return the top-*k* most relevant chunks for *query*.

    Each result dict contains ``doc_id`` (str), ``page`` (int), and
    ``snippet`` (str).
    """
    db = lancedb.connect(LANCEDB_DIR)
    table = db.open_table(TABLE_NAME)

    query_vec = _embed_texts([query])[0]

    results = (
        table.search(query_vec)
        .limit(k)
        .to_list()
    )

    output: List[Dict] = []
    for row in results:
        text = row.get("text", "")
        snippet = text[:200] if text else ""
        output.append({
            "doc_id": str(row["doc_id"]),
            "page": int(row["page"]),
            "snippet": snippet,
        })
    return output


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ingest()
    # Quick smoke test
    sample = search("butterfly migration", 3)
    print("\nSmoke test results for 'butterfly migration':")
    for r in sample:
        print(f"  {r['doc_id']} p{r['page']}: {r['snippet'][:80]!r}")