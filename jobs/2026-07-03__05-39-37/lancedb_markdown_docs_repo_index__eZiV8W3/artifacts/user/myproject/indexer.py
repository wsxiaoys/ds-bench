#!/usr/bin/env python3
"""Markdown Docs Repo Indexer with LanceDB.

Walks /app/docs/ recursively, splits every Markdown file into per-section
chunks, embeds each chunk with OpenAI's text-embedding-3-small model, and
persists the rows into a LanceDB table. Exposes a `search(query, k)` API.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import lancedb
import pyarrow as pa
from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DOCS_ROOT = Path("/app/docs")
LANCEDB_DIR = Path("/home/user/myproject/lancedb")
RUN_ID_FILE = Path("/logs/artifacts/run-id")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536  # text-embedding-3-small native dimension


def _read_run_id() -> str:
    """Read the run id from the artifacts file, used to namespace the table."""
    try:
        return RUN_ID_FILE.read_text().strip()
    except OSError:
        return "default"


RUN_ID = _read_run_id()
TABLE_NAME = f"docs_sections_{RUN_ID}"


# ---------------------------------------------------------------------------
# OpenAI client (real, no mocks)
# ---------------------------------------------------------------------------
def _make_client() -> OpenAI:
    return OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
        base_url=os.environ.get("OPENAI_BASE_URL") or None,
    )


_CLIENT: OpenAI | None = None


def _get_client() -> OpenAI:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = _make_client()
    return _CLIENT


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using the real OpenAI Embeddings API."""
    if not texts:
        return []
    client = _get_client()
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    # Return in the same order as the input.
    return [d.embedding for d in resp.data]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


# ---------------------------------------------------------------------------
# Markdown parsing
# ---------------------------------------------------------------------------
def parse_markdown(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Parse a markdown document.

    Returns (doc_title, [(section_title, section_content), ...]).
    Assumes a single top-level `# Title` and several `## Section` headers.
    """
    lines = text.splitlines()

    doc_title = ""
    sections: list[tuple[str, str]] = []

    current_section_title: str | None = None
    current_body: list[str] = []

    def flush() -> None:
        nonlocal current_section_title, current_body
        if current_section_title is not None:
            content = "\n".join(current_body).strip()
            sections.append((current_section_title, content))
        current_section_title = None
        current_body = []

    for line in lines:
        stripped = line.lstrip()
        # Top-level title
        if stripped.startswith("# ") and not stripped.startswith("## "):
            if doc_title == "":
                doc_title = stripped[2:].strip()
            continue
        # Section header
        if stripped.startswith("## ") and not stripped.startswith("### "):
            flush()
            current_section_title = stripped[3:].strip()
            continue
        # Any line under the current section
        if current_section_title is not None:
            current_body.append(line)

    flush()
    return doc_title, sections


def find_markdown_files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.md") if p.is_file())


def build_rows() -> list[dict[str, Any]]:
    """Walk the docs repo and build one row per section (without embeddings)."""
    rows: list[dict[str, Any]] = []
    for path in find_markdown_files(DOCS_ROOT):
        rel = path.relative_to(DOCS_ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        doc_title, sections = parse_markdown(text)
        for section_title, content in sections:
            if not content.strip():
                continue
            embed_input = f"{section_title}\n{content}"
            rows.append(
                {
                    "repo_path": rel,
                    "doc_title": doc_title,
                    "section_title": section_title,
                    "content": content,
                    "embed_input": embed_input,
                }
            )
    return rows


# ---------------------------------------------------------------------------
# LanceDB schema
# ---------------------------------------------------------------------------
SCHEMA = pa.schema(
    [
        pa.field("repo_path", pa.string()),
        pa.field("doc_title", pa.string()),
        pa.field("section_title", pa.string()),
        pa.field("content", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), EMBEDDING_DIM)),
    ]
)


def _to_arrow_table(rows: list[dict[str, Any]]) -> pa.Table:
    return pa.Table.from_pylist(rows, schema=SCHEMA)


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------
def index_docs() -> None:
    """Build the section rows, embed them, and persist into LanceDB."""
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCEDB_DIR))

    rows = build_rows()
    if not rows:
        raise RuntimeError("No markdown sections found to index.")

    # Embed in a single batch (corpus is small).
    embeddings = embed_texts([r["embed_input"] for r in rows])
    for r, emb in zip(rows, embeddings):
        r["vector"] = [float(x) for x in emb]

    arrow_rows = [
        {
            "repo_path": r["repo_path"],
            "doc_title": r["doc_title"],
            "section_title": r["section_title"],
            "content": r["content"],
            "vector": r["vector"],
        }
        for r in rows
    ]
    table_data = _to_arrow_table(arrow_rows)

    # Idempotent: drop existing table if present, then recreate.
    existing = set(db.table_names())
    if TABLE_NAME in existing:
        db.drop_table(TABLE_NAME)

    db.create_table(TABLE_NAME, data=table_data, mode="overwrite")


# ---------------------------------------------------------------------------
# Search API
# ---------------------------------------------------------------------------
def _get_table():
    db = lancedb.connect(str(LANCEDB_DIR))
    return db.open_table(TABLE_NAME)


def search(query: str, k: int = 5) -> list[dict]:
    """Return the top-k most relevant sections for a natural-language query."""
    query_vec = embed_text(query)
    table = _get_table()

    results = (
        table.search(query_vec, vector_column_name="vector")
        .limit(k)
        .to_list()
    )

    out: list[dict] = []
    for row in results:
        out.append(
            {
                "repo_path": row["repo_path"],
                "doc_title": row["doc_title"],
                "section_title": row["section_title"],
                "score": float(row["_distance"]),
            }
        )
    return out


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    index_docs()
    print(f"Indexed into LanceDB table '{TABLE_NAME}' at {LANCEDB_DIR}")
    # Quick sanity check.
    sample = search("authentication", k=3)
    print(f"Sanity search returned {len(sample)} results.")
    for s in sample:
        print(f"  - {s['repo_path']} :: {s['section_title']} (score={s['score']:.4f})")