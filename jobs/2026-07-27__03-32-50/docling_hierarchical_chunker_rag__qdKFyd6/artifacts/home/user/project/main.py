"""Structure-aware RAG ingestion chunker built on top of Docling.

This script:
  1. Converts `assets/report.pdf` into Docling's structured document model.
  2. Repairs the section-heading hierarchy using each heading's rendered
     font size (Docling's layout model classifies all detected headings
     as generic "section headers" without necessarily assigning correct
     nesting levels, so we recover the true nesting from glyph size).
  3. Splits the document into one chunk per structural element (paragraph,
     table, etc.) using Docling's HierarchicalChunker, which naturally
     tracks the ancestor heading path for every chunk.
  4. Writes the chunks to `output/chunks.jsonl`, one JSON object per line,
     in document reading order.

The whole pipeline runs fully offline: all Docling/HF model artifacts used
here are already cached on disk, and offline env vars are set below before
any model-loading imports happen so nothing ever attempts a network call.
"""

from __future__ import annotations

import json
import os

# Must be set before importing docling/transformers so no component ever
# attempts to reach the network (they are only used as a safety net -
# DOCLING_ARTIFACTS_PATH already points at the local, preinstalled models).
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HOME", "/opt/app-root/src/.cache/huggingface")
os.environ.setdefault(
    "DOCLING_ARTIFACTS_PATH", "/opt/app-root/src/.cache/docling/models"
)

from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker
from docling_core.types.doc.document import SectionHeaderItem, TitleItem

INPUT_PDF = "assets/report.pdf"
OUTPUT_DIR = "output"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "chunks.jsonl")

HEADING_PATH_SEPARATOR = " > "


def _bbox_height(item) -> float:
    """Return the rendered glyph height (a proxy for font size) of a heading."""
    prov = item.prov[0]
    return round(prov.bbox.t - prov.bbox.b, 1)


def repair_heading_levels(doc) -> None:
    """Recompute correct nesting levels for every heading in `doc`.

    Docling's layout model reliably detects *which* text elements are
    section headings, but for this document it labels all of them as
    plain (level 1) section headers, losing the true nested hierarchy.
    We recover the real hierarchy by ranking each heading's font size:
    larger glyphs are shallower (more outer) headings, smaller glyphs are
    deeper (more nested) headings. Levels are re-assigned in place so that
    HierarchicalChunker builds the correct ancestor heading path for every
    chunk.
    """
    headers = [
        item
        for item, _ in doc.iterate_items(with_groups=True)
        if isinstance(item, (SectionHeaderItem, TitleItem))
    ]
    if not headers:
        return

    distinct_heights = sorted({_bbox_height(h) for h in headers}, reverse=True)
    level_by_height = {height: rank + 1 for rank, height in enumerate(distinct_heights)}

    for header in headers:
        if isinstance(header, SectionHeaderItem):
            header.level = level_by_height[_bbox_height(header)]


def chunk_page_no(chunk) -> int:
    """Return the 1-based page number a chunk's content originates from."""
    for doc_item in chunk.meta.doc_items:
        if doc_item.prov:
            return doc_item.prov[0].page_no
    return 1


def build_text(heading_path: list[str], chunk_text: str) -> str:
    """Build the emitted chunk text: heading path prefix + chunk content."""
    prefix = HEADING_PATH_SEPARATOR.join(heading_path)
    if not chunk_text:
        return prefix
    return f"{prefix}\n\n{chunk_text}"


def main() -> None:
    converter = DocumentConverter()
    result = converter.convert(INPUT_PDF)
    doc = result.document

    repair_heading_levels(doc)

    chunker = HierarchicalChunker()
    chunks = list(chunker.chunk(doc))

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for idx, chunk in enumerate(chunks):
            heading_path = list(chunk.meta.headings or [])
            record = {
                "id": idx,
                "heading_path": heading_path,
                "text": build_text(heading_path, chunk.text),
                "page_no": chunk_page_no(chunk),
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Wrote {len(chunks)} chunks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
