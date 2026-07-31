"""Docling-backed conversion + persistence of the three result
representations (markdown, structured json, structure-aware chunks).

This module is invoked from a worker thread (see gateway.py) so it may block
freely; it must never touch the asyncio event loop.
"""
from __future__ import annotations

import json
from pathlib import Path

from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker


def convert_and_persist(source_path: str, result_dir: Path, job_id: str) -> None:
    """Convert the document at `source_path` and write the three result
    representations into `result_dir`. Raises on any conversion failure;
    callers are responsible for turning that into a CONVERSION_FAILED job
    error.
    """
    converter = DocumentConverter()
    conv_result = converter.convert(source_path)
    doc = conv_result.document

    markdown = doc.export_to_markdown()
    document_dict = doc.export_to_dict()

    chunker = HierarchicalChunker()
    chunks: list[dict] = []
    for chunk in chunker.chunk(doc):
        text = chunk.text or ""
        if not text.strip():
            continue
        headings = list(getattr(chunk.meta, "headings", None) or [])
        chunks.append(
            {
                "index": len(chunks),
                "text": text,
                "headings": headings,
                "char_len": len(text),
            }
        )

    result_dir.mkdir(parents=True, exist_ok=True)

    (result_dir / "markdown.md").write_text(markdown, encoding="utf-8")

    doc_json = json.dumps(
        {"job_id": job_id, "format": "json", "document": document_dict}, ensure_ascii=False
    )
    (result_dir / "document.json").write_text(doc_json, encoding="utf-8")

    chunks_json = json.dumps(
        {"job_id": job_id, "format": "chunks", "count": len(chunks), "chunks": chunks},
        ensure_ascii=False,
    )
    (result_dir / "chunks.json").write_text(chunks_json, encoding="utf-8")
