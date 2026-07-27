#!/usr/bin/env python3
"""Semantic section splitter for structured PDF documents.

Parses assets/report.pdf using Docling and produces:
  - output/sections/<NN>-<slug>.md  (one per H1 section)
  - output/toc.json                 (hierarchical table of contents)
  - output/index.md                 (root index with links to sections)
"""

import json
import os
import re
from pathlib import Path

from docling.document_converter import DocumentConverter


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

OUTLINE_RE = re.compile(r"^\d+(\.\d+){0,2}\s")


def slug(s: str) -> str:
    """Convert a section heading string to a URL-friendly slug."""
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def outline_level(text: str) -> int | None:
    """Return 1, 2, or 3 if *text* starts with an outline number, else None."""
    m = OUTLINE_RE.match(text)
    if not m:
        return None
    # number of dot-separated components
    prefix = m.group().rstrip()
    return prefix.count(".") + 1


def is_heading(text: str) -> bool:
    """True iff *text* matches the outline-number heading pattern."""
    return OUTLINE_RE.match(text) is not None


def page_no(item) -> int:
    """Return the 1-based page number of a Docling item."""
    if item.prov and len(item.prov) > 0:
        return item.prov[0].page_no
    return 1


# ---------------------------------------------------------------------------
# main pipeline
# ---------------------------------------------------------------------------

def main() -> None:
    project = Path(__file__).resolve().parent
    pdf_path = project / "assets" / "report.pdf"
    output_dir = project / "output"
    sections_dir = output_dir / "sections"

    # Clean + recreate output tree
    if output_dir.exists():
        import shutil

        shutil.rmtree(output_dir)
    sections_dir.mkdir(parents=True, exist_ok=True)

    # ---- 1. Parse the PDF ----
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    doc = result.document

    items = list(doc.texts)  # reading-order list of text items

    # ---- 2. Build a flat list of "blocks" ----
    # Each block is either a heading (level 1-3) or body text.
    blocks: list[dict] = []
    # The very first item (index 0) is the document title (no outline number).
    title_text = items[0].text

    for item in items:
        text = item.text
        level = outline_level(text)
        if level is not None:
            blocks.append({
                "kind": "heading",
                "text": text,
                "level": level,
                "page": page_no(item),
                "slug": slug(text),
                "children": [],  # will be populated for the tree
            })
        elif item is items[0]:
            # This is the title; skip it from blocks (handled separately).
            pass
        else:
            blocks.append({
                "kind": "body",
                "text": text,
            })

    # ---- 3. Build the heading tree and assign body blocks to sections ----
    # We walk through blocks and maintain a stack of current headings at each level.
    # Root sections are level-1 headings.

    h1_sections: list[dict] = []  # top-level section nodes (for toc.json)
    current_h1: dict | None = None
    current_h2: dict | None = None
    current_h3: dict | None = None

    # We also need to collect body blocks per section for file generation.
    # Use a parallel structure: a flat list of sections (H1) each with their own
    # ordered list of content blocks (headings + body).

    # First pass: build the tree structure from headings only.
    heading_stack: list[dict] = []  # stack of [h1, h2, h3] heading nodes

    for block in blocks:
        if block["kind"] == "heading":
            node = {
                "title": block["text"],
                "level": block["level"],
                "anchor": block["slug"],
                "page_no": block["page"],
                "children": [],
            }
            level = block["level"]

            if level == 1:
                heading_stack = [node]
                h1_sections.append(node)
            elif level == 2:
                heading_stack = heading_stack[:1] + [node]
                if heading_stack[0]["children"] is not None:
                    heading_stack[0]["children"].append(node)
            elif level == 3:
                heading_stack = heading_stack[:2] + [node]
                if len(heading_stack) >= 2 and heading_stack[1]["children"] is not None:
                    heading_stack[1]["children"].append(node)

    # ---- 4. Assign body content to the correct H1 section ----
    # We iterate blocks, tracking the current H1, H2, H3, and collect
    # content per H1.

    # Build a list of (h1_index, content_lines) for each H1 section.
    h1_contents: list[list[str]] = []  # parallel to h1_sections
    h1_filenames: list[str] = []       # parallel to h1_sections

    for i, node in enumerate(h1_sections):
        h1_contents.append([])
        nn = f"{i + 1:02d}"
        fn = f"{nn}-{slug(node['title'])}.md"
        h1_filenames.append(fn)
        node["filename"] = f"sections/{fn}"

    current_h1_idx = -1
    current_h2_node = None
    current_h3_node = None

    for block in blocks:
        if block["kind"] == "heading":
            level = block["level"]
            if level == 1:
                current_h1_idx += 1
                current_h2_node = None
                current_h3_node = None
            elif level == 2:
                current_h2_node = block
                current_h3_node = None
            elif level == 3:
                current_h3_node = block

            # Add the heading line to the current H1 section's content
            if current_h1_idx >= 0:
                md_heading = "#" * level + " " + block["text"]
                h1_contents[current_h1_idx].append(md_heading)
        else:
            # body block
            if current_h1_idx >= 0:
                h1_contents[current_h1_idx].append(block["text"])

    # ---- 5. Write section Markdown files ----
    num_h1 = len(h1_sections)

    for i in range(num_h1):
        lines: list[str] = []

        # The first heading is the H1 itself
        # h1_contents already has the heading lines and body content in order
        lines.extend(h1_contents[i])

        # Add navigation links at the end
        lines.append("")  # blank line before nav
        nav_links = []
        nav_links.append("[Index](../index.md)")
        if i > 0:
            nav_links.append(f"[Previous]({h1_filenames[i - 1]})")
        if i < num_h1 - 1:
            nav_links.append(f"[Next]({h1_filenames[i + 1]})")
        lines.append(" | ".join(nav_links))
        lines.append("")  # trailing newline

        filepath = sections_dir / h1_filenames[i]
        filepath.write_text("\n".join(lines) + "\n")

    # ---- 6. Write toc.json ----
    toc = {
        "title": title_text,
        "sections": h1_sections,
    }
    toc_path = output_dir / "toc.json"
    toc_path.write_text(json.dumps(toc, indent=2) + "\n")

    # ---- 7. Write index.md ----
    index_lines: list[str] = []
    for i, node in enumerate(h1_sections):
        index_lines.append(f"[{node['title']}](sections/{h1_filenames[i]})")
    index_path = output_dir / "index.md"
    index_path.write_text("\n".join(index_lines) + "\n")


if __name__ == "__main__":
    main()
