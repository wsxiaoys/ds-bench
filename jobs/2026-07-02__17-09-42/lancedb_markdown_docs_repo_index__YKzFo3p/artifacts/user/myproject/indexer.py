"""Semantic indexer for the /app/docs Markdown repository.

Walks ``/app/docs/`` recursively, splits each Markdown file into per-section
chunks, embeds every chunk with the OpenAI ``text-embedding-3-small`` model,
and persists the result into a LanceDB table under
``/home/user/myproject/lancedb/``.  The table name is suffixed with the value
of ``/logs/artifacts/run-id`` so concurrent runs cannot collide.

Running this file directly (``python3 /home/user/myproject/indexer.py``)
triggers a full (idempotent) re-index.

Exposes:

* ``build_index()`` — rebuilds the LanceDB table from disk.
* ``search(query, k=5)`` — returns the top-k most relevant sections.
"""

from __future__ import annotations

import os
import pathlib
import re
import sys
from typing import Iterable

import lancedb
import pyarrow as pa
from openai import OpenAI


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DOCS_ROOT = pathlib.Path("/app/docs")
LANCEDB_DIR = pathlib.Path("/home/user/myproject/lancedb")
RUN_ID_PATH = pathlib.Path("/logs/artifacts/run-id")
EMBED_MODEL = "text-embedding-3-small"

# Match a Markdown header line, e.g. ``# Title`` or ``## Section``.
_HEADER_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")


def _read_run_id() -> str:
    """Return the run id stored at ``/logs/artifacts/run-id``.

    Falls back to ``"default"`` if the file is missing or empty so the module
    remains importable in environments without the verifier-provided run id.
    """

    try:
        value = RUN_ID_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "default"
    return value or "default"


def table_name(run_id: str | None = None) -> str:
    """Return the LanceDB table name for a given run id."""

    return f"docs_sections_{run_id or _read_run_id()}"


# ---------------------------------------------------------------------------
# Markdown parsing
# ---------------------------------------------------------------------------


def parse_markdown(text: str) -> list[tuple[str, str, str]]:
    """Split a Markdown document into ``(doc_title, section_title, content)``.

    The corpus is plain CommonMark with a single top-level ``# Title`` and any
    number of ``## Section`` headers.  Only ``## Section`` lines produce rows;
    the ``# Title`` is used solely to populate ``doc_title``.  Any text that
    appears between the document title and the first section is discarded
    because the requirements ask for one row per ``## section``.
    """

    lines = text.splitlines()
    doc_title: str | None = None
    sections: list[tuple[str, list[str]]] = []  # (section_title, body_lines)
    current_title: str | None = None
    current_body: list[str] = []

    for raw in lines:
        match = _HEADER_RE.match(raw)
        if not match:
            if current_title is not None:
                current_body.append(raw)
            continue

        hashes, header = match.group(1), match.group(2).strip()
        level = len(hashes)

        if level == 1:
            # Document title — recorded but not emitted as a section.
            if doc_title is None:
                doc_title = header
            else:
                # Multiple top-level headers: treat the later ones as the start
                # of a new section so no content is silently lost.
                if current_title is not None:
                    sections.append((current_title, current_body))
                current_title = header
                current_body = []
        elif level == 2:
            # New section.
            if current_title is not None:
                sections.append((current_title, current_body))
            current_title = header
            current_body = []
        else:
            # Deeper headers become part of the current section body.
            if current_title is not None:
                current_body.append(raw)

    if current_title is not None:
        sections.append((current_title, current_body))

    if doc_title is None:
        doc_title = "(untitled)"

    chunks: list[tuple[str, str, str]] = []
    for sec_title, body in sections:
        content = "\n".join(body).strip("\n")
        if not content.strip():
            continue
        chunks.append((doc_title, sec_title, content))

    return chunks


# ---------------------------------------------------------------------------
# OpenAI embeddings
# ---------------------------------------------------------------------------


def _get_client() -> OpenAI:
    """Construct an OpenAI client honouring ``OPENAI_BASE_URL`` if set."""

    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


def embed_texts(texts: Iterable[str]) -> list[list[float]]:
    """Embed an iterable of strings with the configured OpenAI model.

    The OpenAI embeddings endpoint accepts up to 2048 inputs per call, so we
    batch defensively in chunks of 256 to stay well within the limit even for
    larger corpora.
    """

    client = _get_client()
    inputs = list(texts)
    vectors: list[list[float]] = []

    batch_size = 256
    for start in range(0, len(inputs), batch_size):
        batch = inputs[start : start + batch_size]
        # The OpenAI client raises ``BadRequestError`` for empty input — guard
        # against it so the indexer is robust to malformed documents.
        if not batch:
            continue
        resp = client.embeddings.create(model=EMBED_MODEL, input=batch)
        # Preserve ordering: ``resp.data`` is returned in input order.
        ordered = sorted(resp.data, key=lambda item: item.index)
        vectors.extend([list(item.embedding) for item in ordered])

    return vectors


# ---------------------------------------------------------------------------
# Index construction
# ---------------------------------------------------------------------------


def _iter_markdown_files(root: pathlib.Path) -> Iterable[pathlib.Path]:
    """Yield every ``.md`` file under ``root`` in deterministic order."""

    for path in sorted(root.rglob("*.md")):
        if path.is_file():
            yield path


def _build_rows() -> list[dict]:
    """Walk the docs tree and produce embedding rows for every section."""

    rows: list[dict] = []
    texts_to_embed: list[str] = []

    for md_path in _iter_markdown_files(DOCS_ROOT):
        repo_path = str(md_path.relative_to(DOCS_ROOT))
        text = md_path.read_text(encoding="utf-8")
        chunks = parse_markdown(text)
        for doc_title, section_title, content in chunks:
            rows.append(
                {
                    "repo_path": repo_path,
                    "doc_title": doc_title,
                    "section_title": section_title,
                    "content": content,
                    "_embed_input": f"{section_title}\n\n{content}",
                }
            )
            texts_to_embed.append(rows[-1]["_embed_input"])

    vectors = embed_texts(texts_to_embed)
    if len(vectors) != len(rows):
        raise RuntimeError(
            f"Embedding count mismatch: {len(vectors)} vectors for "
            f"{len(rows)} rows"
        )

    for row, vector in zip(rows, vectors):
        row["embedding"] = vector
        row.pop("_embed_input", None)

    return rows


def build_index(run_id: str | None = None) -> str:
    """Rebuild the LanceDB table and return its name."""

    run_id = run_id or _read_run_id()
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCEDB_DIR))

    rows = _build_rows()
    if not rows:
        raise RuntimeError("No sections found to index under /app/docs")

    schema = pa.schema(
        [
            pa.field("repo_path", pa.string()),
            pa.field("doc_title", pa.string()),
            pa.field("section_title", pa.string()),
            pa.field("content", pa.string()),
            pa.field("embedding", pa.list_(pa.float32(), list_size=len(rows[0]["embedding"]))),
        ]
    )

    # ``mode="overwrite"`` makes re-runs with the same run-id idempotent: the
    # table is dropped and recreated so we never accumulate duplicates.
    table = db.create_table(table_name(run_id), data=rows, schema=schema, mode="overwrite")
    return table_name(run_id)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


def _open_table(run_id: str | None = None):
    db = lancedb.connect(str(LANCEDB_DIR))
    return db.open_table(table_name(run_id))


def search(query: str, k: int = 5, run_id: str | None = None) -> list[dict]:
    """Return the top-``k`` sections most relevant to ``query``."""

    if not query or not query.strip():
        raise ValueError("query must be a non-empty string")

    if k <= 0:
        raise ValueError("k must be a positive integer")

    run_id = run_id or _read_run_id()
    table = _open_table(run_id)
    query_vec = embed_texts([query])[0]

    results = (
        table.search(query_vec, vector_column_name="embedding")
        .metric("cosine")
        .limit(k)
        .to_list()
    )

    output: list[dict] = []
    for row in results:
        # LanceDB returns a ``_distance`` column when using ``search``.  For
        # cosine distance, similarity (1 - distance) is more intuitive.
        distance = row.pop("_distance", None)
        score = 1.0 - float(distance) if distance is not None else float("nan")
        output.append(
            {
                "repo_path": row["repo_path"],
                "doc_title": row["doc_title"],
                "section_title": row["section_title"],
                "score": score,
            }
        )
    return output


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    name = build_index()
    print(f"Indexed into table '{name}' under {LANCEDB_DIR}")
    sample = search("How do I roll back a failed database migration?", k=3)
    print("Sample search results:")
    for hit in sample:
        print(
            f"  {hit['score']:.4f}  {hit['repo_path']} :: "
            f"{hit['doc_title']} / {hit['section_title']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())