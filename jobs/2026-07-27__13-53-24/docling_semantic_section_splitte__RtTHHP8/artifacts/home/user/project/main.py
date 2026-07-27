#!/usr/bin/env python3
"""
Semantic Section Splitter for a Structured PDF.

Parses assets/report.pdf with Docling into a DoclingDocument, then splits the
document into one Markdown file per top-level (H1) section, a hierarchical
table of contents (output/toc.json), and a root index (output/index.md) with
working relative cross-links.

Heading detection / leveling is done purely from the leading outline number
in the text (per the task's contract), never from any model-predicted level.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from docling.document_converter import DocumentConverter

PROJECT_ROOT = Path(__file__).resolve().parent
PDF_PATH = PROJECT_ROOT / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_ROOT / "output"
SECTIONS_DIR = OUTPUT_DIR / "sections"

HEADING_RE = re.compile(r"^\d+(\.\d+){0,2}\s")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def slug(s: str) -> str:
    """Lowercase, collapse non [a-z0-9] runs to '-', strip leading/trailing '-'."""
    lowered = s.lower()
    collapsed = NON_ALNUM_RE.sub("-", lowered)
    return collapsed.strip("-")


def heading_level(text: str) -> Optional[int]:
    """Return the heading level (1, 2, or 3) if text is a section heading, else None."""
    m = HEADING_RE.match(text)
    if not m:
        return None
    number = text.split(None, 1)[0]
    return number.count(".") + 1


@dataclass
class Node:
    title: str
    level: int
    page_no: int
    children: list = field(default_factory=list)
    # H1-only bookkeeping (not emitted for level 2/3):
    order_index: Optional[int] = None  # 1-based position among H1 sections
    filename: Optional[str] = None  # sections/<NN>-<slug>.md

    @property
    def anchor(self) -> str:
        return slug(self.title)

    def to_toc_dict(self) -> dict:
        d = {
            "title": self.title,
            "level": self.level,
            "anchor": self.anchor,
            "page_no": self.page_no,
            "children": [c.to_toc_dict() for c in self.children],
        }
        if self.level == 1:
            d["filename"] = self.filename
        return d


def extract_items(doc) -> list[tuple[str, int]]:
    """Return a list of (text, page_no) tuples for every text item, in reading order."""
    items = []
    for text_item in doc.texts:
        text = text_item.text.strip()
        if not text:
            continue
        page_no = 1
        if getattr(text_item, "prov", None):
            page_no = text_item.prov[0].page_no
        items.append((text, page_no))
    return items


def build_tree(items: list[tuple[str, int]]):
    """
    Build the heading tree plus, for every H1 section, the ordered list of
    markdown lines (headings + body paragraphs) that belong to it.

    Returns (title, h1_nodes, h1_markdown_lines) where h1_markdown_lines is a
    list (parallel to h1_nodes) of lists of markdown-ready lines.
    """
    if not items:
        raise ValueError("No text items found in document")

    doc_title = items[0][0]

    h1_nodes: list[Node] = []
    h1_markdown_lines: list[list[str]] = []

    # Stack of currently-open heading nodes, indexable by level (1-based).
    stack: dict[int, Node] = {}
    current_node: Optional[Node] = None
    current_h1_lines: Optional[list[str]] = None
    h1_count = 0

    for text, page_no in items[1:]:
        level = heading_level(text)
        if level is not None:
            node = Node(title=text, level=level, page_no=page_no)

            if level == 1:
                h1_count += 1
                node.order_index = h1_count
                node.filename = f"sections/{h1_count:02d}-{slug(text)}.md"
                h1_nodes.append(node)
                current_h1_lines = []
                h1_markdown_lines.append(current_h1_lines)
            else:
                parent = stack.get(level - 1)
                if parent is None:
                    # Defensive fallback: attach to the deepest currently open node,
                    # or start a new top-level section if none exists yet.
                    if stack:
                        parent = stack[max(stack.keys())]
                    else:
                        h1_count += 1
                        node.level = 1
                        node.order_index = h1_count
                        node.filename = f"sections/{h1_count:02d}-{slug(text)}.md"
                        h1_nodes.append(node)
                        current_h1_lines = []
                        h1_markdown_lines.append(current_h1_lines)
                        parent = None
                if parent is not None:
                    parent.children.append(node)

            # Clear any deeper levels that are no longer open.
            for lvl in list(stack.keys()):
                if lvl >= node.level:
                    del stack[lvl]
            stack[node.level] = node

            current_node = node
            if current_h1_lines is not None:
                current_h1_lines.append(f"{'#' * node.level} {node.title}")
        else:
            # Body content belongs to the most recent heading.
            if current_h1_lines is not None:
                current_h1_lines.append(text)
            # else: text before any heading (other than the title) is dropped;
            # per the document contract this should not occur.
            _ = current_node  # current_node retained for clarity/debugging

    return doc_title, h1_nodes, h1_markdown_lines


def relative_link(from_dir: Path, to_path: Path) -> str:
    rel = os.path.relpath(to_path, start=from_dir)
    return rel.replace(os.sep, "/")


def write_section_files(h1_nodes: list[Node], h1_markdown_lines: list[list[str]]) -> None:
    SECTIONS_DIR.mkdir(parents=True, exist_ok=True)
    n = len(h1_nodes)

    for i, node in enumerate(h1_nodes):
        section_path = OUTPUT_DIR / node.filename
        lines = list(h1_markdown_lines[i])

        nav_links = [f"[Index]({relative_link(SECTIONS_DIR, OUTPUT_DIR / 'index.md')})"]
        if i > 0:
            prev_node = h1_nodes[i - 1]
            nav_links.append(
                f"[Previous]({relative_link(SECTIONS_DIR, OUTPUT_DIR / prev_node.filename)})"
            )
        if i < n - 1:
            next_node = h1_nodes[i + 1]
            nav_links.append(
                f"[Next]({relative_link(SECTIONS_DIR, OUTPUT_DIR / next_node.filename)})"
            )

        content_parts = list(lines)
        content_parts.append("")
        content_parts.append(" | ".join(nav_links))

        section_path.write_text("\n\n".join(content_parts) + "\n", encoding="utf-8")


def write_index(doc_title: str, h1_nodes: list[Node]) -> None:
    lines = [f"# {doc_title}", ""]
    for node in h1_nodes:
        target = relative_link(OUTPUT_DIR, OUTPUT_DIR / node.filename)
        lines.append(f"[{node.title}]({target})")
    (OUTPUT_DIR / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_toc(doc_title: str, h1_nodes: list[Node]) -> None:
    toc = {
        "title": doc_title,
        "sections": [node.to_toc_dict() for node in h1_nodes],
    }
    (OUTPUT_DIR / "toc.json").write_text(
        json.dumps(toc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SECTIONS_DIR.mkdir(parents=True, exist_ok=True)

    converter = DocumentConverter()
    result = converter.convert(str(PDF_PATH))
    doc = result.document

    items = extract_items(doc)
    doc_title, h1_nodes, h1_markdown_lines = build_tree(items)

    write_section_files(h1_nodes, h1_markdown_lines)
    write_index(doc_title, h1_nodes)
    write_toc(doc_title, h1_nodes)

    print(f"Wrote {len(h1_nodes)} section file(s) to {SECTIONS_DIR}")
    print(f"Wrote {OUTPUT_DIR / 'index.md'}")
    print(f"Wrote {OUTPUT_DIR / 'toc.json'}")


if __name__ == "__main__":
    main()
