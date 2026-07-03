"""PDF ingestion and semantic search pipeline.

Reads PDFs from /app/corpus/, chunks them, embeds the chunks with OpenAI,
stores everything in a LanceDB table, and exposes a ``search(query, k)``
function that returns the most semantically similar chunks.
"""

from __future__ import annotations

import os
import glob
import re
import sys
from typing import Iterable

import httpx
import lancedb
import openai
import pyarrow as pa
from pypdf import PdfReader


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

CORPUS_DIR = "/app/corpus"
LANCEDB_DIR = "/home/user/myproject/lancedb"
RUN_ID_PATH = "/logs/artifacts/run-id"

EMBEDDING_MODEL = "text-embedding-3-small"  # 1536-dimensional embeddings
EMBEDDING_DIM = 1536

# Character-based chunking strategy. Each page is ~500-900 chars; we keep chunks
# small enough that they remain focused on a single topic while still giving
# the embedding model enough context.
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100

# Snippet length returned by ``search``.
SNIPPET_MAX_CHARS = 240


# -----------------------------------------------------------------------------
# OpenAI client (workaround for httpx 0.28 vs openai 1.54.x "proxies" mismatch)
# -----------------------------------------------------------------------------

def _make_openai_client() -> openai.OpenAI:
    """Return an OpenAI client that works around the httpx/openai mismatch.

    ``openai==1.54.5`` passes a ``proxies`` kwarg to ``httpx.Client`` that was
    removed in ``httpx>=0.28``. Passing an explicit ``http_client`` (without
    ``proxies``) avoids the conflict.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    base_url = os.environ.get("OPENAI_BASE_URL")
    kwargs = {"api_key": api_key, "http_client": httpx.Client()}
    if base_url:
        kwargs["base_url"] = base_url
    return openai.OpenAI(**kwargs)


_CLIENT: openai.OpenAI | None = None


def _client() -> openai.OpenAI:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = _make_openai_client()
    return _CLIENT


# -----------------------------------------------------------------------------
# Run id and table name
# -----------------------------------------------------------------------------

def _read_run_id() -> str:
    try:
        with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return "default"


TABLE_NAME = f"pdf_chunks_{_read_run_id()}"


# -----------------------------------------------------------------------------
# PDF reading and chunking
# -----------------------------------------------------------------------------

def _read_pdf_text(path: str) -> list[tuple[int, str]]:
    """Return a list of ``(page_number, text)`` pairs for ``path``.

    Page numbers are 1-based.
    """
    reader = PdfReader(path)
    pages: list[tuple[int, str]] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append((idx, text))
    return pages


_WHITESPACE_RE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", text).strip()


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split ``text`` into overlapping character-based chunks.

    Each chunk is at most ``size`` characters long and shares ``overlap``
    characters with the previous chunk.
    """
    text = _normalize(text)
    if not text:
        return []
    if len(text) <= size:
        return [text]

    step = size - overlap
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start += step
    return chunks


def _iter_pdf_documents(corpus_dir: str) -> Iterable[tuple[str, list[tuple[int, str]]]]:
    for path in sorted(glob.glob(os.path.join(corpus_dir, "*.pdf"))):
        doc_id = os.path.splitext(os.path.basename(path))[0]
        yield doc_id, _read_pdf_text(path)


# -----------------------------------------------------------------------------
# Embeddings
# -----------------------------------------------------------------------------

def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed ``texts`` using the OpenAI embeddings API in batches."""
    if not texts:
        return []

    client = _client()
    vectors: list[list[float]] = []

    # The API accepts up to ~2048 inputs per call; keep batches modest to avoid
    # request size limits.
    batch_size = 64
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
            encoding_format="float",
        )
        # ``response.data`` preserves input order.
        batch_vectors = [item.embedding for item in response.data]
        if len(batch_vectors) != len(batch):
            raise RuntimeError(
                f"Embedding response mismatch: got {len(batch_vectors)} vectors "
                f"for {len(batch)} inputs"
            )
        vectors.extend(batch_vectors)
    return vectors


def _embed_query(query: str) -> list[float]:
    client = _client()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=[query],
        encoding_format="float",
    )
    return response.data[0].embedding


# -----------------------------------------------------------------------------
# LanceDB helpers
# -----------------------------------------------------------------------------

def _connect() -> lancedb.DBConnection:
    os.makedirs(LANCEDB_DIR, exist_ok=True)
    return lancedb.connect(LANCEDB_DIR)


_TABLE_SCHEMA = pa.schema(
    [
        pa.field("doc_id", pa.string(), nullable=False),
        pa.field("page", pa.int32(), nullable=False),
        pa.field("chunk_id", pa.string(), nullable=False),
        pa.field("text", pa.string(), nullable=False),
        pa.field("embedding", pa.list_(pa.float32(), EMBEDDING_DIM), nullable=False),
    ]
)


def _build_records() -> list[dict]:
    """Read the corpus, chunk and embed the text, and return row dicts."""
    rows: list[dict] = []
    texts_to_embed: list[str] = []

    for doc_id, pages in _iter_pdf_documents(CORPUS_DIR):
        for page_num, page_text in pages:
            chunks = _chunk_text(page_text)
            for chunk_idx, chunk in enumerate(chunks):
                chunk_id = f"{doc_id}_p{page_num:03d}_c{chunk_idx:03d}"
                rows.append(
                    {
                        "doc_id": doc_id,
                        "page": int(page_num),
                        "chunk_id": chunk_id,
                        "text": chunk,
                        # embedding filled in after the batch call
                        "embedding": None,
                    }
                )
                texts_to_embed.append(chunk)

    if not rows:
        raise RuntimeError(f"No PDF chunks found under {CORPUS_DIR}")

    vectors = _embed_texts(texts_to_embed)
    if len(vectors) != len(rows):
        raise RuntimeError(
            f"Embedding count mismatch: {len(vectors)} vectors for {len(rows)} rows"
        )
    for row, vec in zip(rows, vectors):
        row["embedding"] = vec
    return rows


def ingest() -> str:
    """Build (or rebuild) the LanceDB table and return its name.

    Running this function more than once with the same ``/logs/artifacts/run-id``
    is safe: the existing table is dropped and re-created so the database is
    left in a consistent, queryable state.
    """
    db = _connect()
    rows = _build_records()

    # Drop the existing table (if any) for a clean idempotent re-run.
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)

    db.create_table(TABLE_NAME, data=rows, schema=_TABLE_SCHEMA, mode="create")
    return TABLE_NAME


def _open_table():
    db = _connect()
    if TABLE_NAME not in db.table_names():
        # Lazy ingestion: if the table isn't there yet, build it.
        ingest()
    return db.open_table(TABLE_NAME)


# -----------------------------------------------------------------------------
# Public search API
# -----------------------------------------------------------------------------

def _make_snippet(text: str, max_chars: int = SNIPPET_MAX_CHARS) -> str:
    text = _normalize(text)
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars].rsplit(" ", 1)[0]
    if len(truncated) < max_chars // 2:
        truncated = text[:max_chars]
    return truncated + "..."


def search(query: str, k: int = 5) -> list[dict]:
    """Return the top-``k`` chunks most semantically similar to ``query``.

    Each result is a dict with the keys ``doc_id`` (str), ``page`` (int) and
    ``snippet`` (str). Results are ordered by descending relevance.
    """
    if not isinstance(query, str) or not query.strip():
        raise ValueError("query must be a non-empty string")
    if not isinstance(k, int) or k <= 0:
        raise ValueError("k must be a positive integer")

    query_vec = _embed_query(query.strip())
    table = _open_table()

    # LanceDB defaults to L2 distance; convert to a relevance score so that
    # "higher is better". The order in ``.to_list()`` already matches the
    # distance ordering produced by ``table.search``.
    results = (
        table.search(query_vec, vector_column_name="embedding")
        .metric("cosine")
        .limit(k)
        .to_list()
    )

    output: list[dict] = []
    for row in results:
        text = row.get("text", "")
        output.append(
            {
                "doc_id": str(row["doc_id"]),
                "page": int(row["page"]),
                "snippet": _make_snippet(text),
            }
        )
    return output


# -----------------------------------------------------------------------------
# CLI entry point
# -----------------------------------------------------------------------------

def main() -> int:
    table_name = ingest()
    table = _connect().open_table(table_name)
    print(
        f"Ingested {table.count_rows()} chunks into table '{table_name}' "
        f"at {LANCEDB_DIR}",
        file=sys.stderr,
    )

    demo_queries = [
        "butterflies migrating across the Sahara",
        "encryption keys rotation",
        "quantum gyroscope calibration",
    ]
    for q in demo_queries:
        print(f"\nQUERY: {q}", file=sys.stderr)
        for hit in search(q, k=3):
            print(
                f"  {hit['doc_id']} p.{hit['page']}: {hit['snippet']}",
                file=sys.stderr,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())