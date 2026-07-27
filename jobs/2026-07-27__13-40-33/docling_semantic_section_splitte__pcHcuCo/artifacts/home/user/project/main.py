"""Semantic section splitter for a structured PDF.

Parses ``assets/report.pdf`` with Docling into a ``DoclingDocument`` and splits
it into one Markdown file per top-level (H1) section, plus a hierarchical
``toc.json`` and an ``index.md`` with working relative cross-links.

Heading levels are determined *deterministically* from the outline number
encoded in the heading text (``1``, ``1.1``, ``1.1.1``), never from the
model-predicted heading level, which is flat and unreliable for PDFs.

Run with the project path as the working directory::

    python main.py
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from docling.document_converter import DocumentConverter

# --- Configuration -----------------------------------------------------------

PROJECT_DIR = Path(__file__).resolve().parent
PDF_PATH = PROJECT_DIR / "assets" / "report.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"
SECTIONS_DIR = OUTPUT_DIR / "sections"

# A section heading begins with a hierarchical outline number: one to three
# dot-separated integers followed by a space, e.g. "1 Introduction",
# "2.1 Data Collection", "3.2.1 Limitations".
OUTLINE_RE = re.compile(r"^(\d+(?:\.\d+){0,2})\s")

# Labels that designate heading-like elements (as opposed to body text).
HEADING_LABELS = {"section_header", "title"}


# --- Helpers -----------------------------------------------------------------

def slug(s: str) -> str:
    """Lowercase ``s``, collapse runs of non ``[a-z0-9]`` to a single ``-``,
    and strip leading/trailing ``-``."""
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def outline_level(text: str) -> int | None:
    """Return the heading level (1, 2 or 3) implied by the leading outline
    number of ``text``, or ``None`` if ``text`` is not a section heading."""
    m = OUTLINE_RE.match(text)
    if not m:
        return None
    return m.group(1).count(".") + 1


# --- Document model ----------------------------------------------------------

class Heading:
    """A section heading with its deterministic level and page number."""

    __slots__ = ("title", "level", "page_no")

    def __init__(self, title: str, level: int, page_no: int) -> None:
        self.title = title
        self.level = level
        self.page_no = page_no


class Section:
    """A top-level (H1) section: its heading plus the ordered list of entries
    (descendant headings and body text) that belong to it."""

    __slots__ = ("heading", "entries")

    def __init__(self, heading: Heading) -> None:
        self.heading = heading
        # Each entry is either a Heading (a descendant heading) or a str
        # (a body text block), in reading order.
        self.entries: list[Heading | str] = []

    def add_heading(self, h: Heading) -> None:
        self.entries.append(h)

    def add_body(self, text: str) -> None:
        self.entries.append(text)


# --- Parsing -----------------------------------------------------------------

def parse_document() -> tuple[str, list[Section]]:
    """Parse the PDF and return ``(title, h1_sections)``.

    Iterates the document items in reading order, classifying each as the
    document title, a section heading (level from the outline number), or body
    content belonging to the most recent heading.
    """
    converter = DocumentConverter()
    result = converter.convert(PDF_PATH)
    doc = result.document

    title: str | None = None
    sections: list[Section] = []
    current: Section | None = None

    for item, _level in doc.iterate_items():
        text = getattr(item, "text", None)
        if text is None:
            # Non-textual items (pictures, tables, ...) are not expected in
            # this document; skip them defensively.
            continue
        text = text.strip()

        is_heading_element = item.label in HEADING_LABELS
        level = outline_level(text) if is_heading_element else None

        if level is not None:
            # A genuine section heading.
            prov_page = item.prov[0].page_no if item.prov else 0
            heading = Heading(text, level, prov_page)
            if level == 1:
                current = Section(heading)
                sections.append(current)
                # The H1 heading itself is rendered separately as the file's
                # first line; only descendants go into `entries`.
            else:
                # Nested heading: belongs to the most recent H1 section.
                if current is not None:
                    current.add_heading(heading)
        elif is_heading_element:
            # A heading-like element without an outline number is the document
            # title (there is exactly one, per the input contract).
            if title is None:
                title = text
        else:
            # Body content: belongs to the most recent heading, hence to its
            # enclosing H1 section.
            if current is not None and text:
                current.add_body(text)

    if title is None:
        title = ""
    return title, sections


# --- Tree building -----------------------------------------------------------

class TreeNode:
    """A node of the hierarchical table of contents."""

    __slots__ = ("title", "level", "anchor", "page_no", "children", "filename")

    def __init__(self, heading: Heading, filename: str | None) -> None:
        self.title = heading.title
        self.level = heading.level
        self.anchor = slug(heading.title)
        self.page_no = heading.page_no
        self.children: list[TreeNode] = []
        self.filename = filename  # only set for level-1 nodes

    def to_dict(self) -> dict:
        d = {
            "title": self.title,
            "level": self.level,
            "anchor": self.anchor,
            "page_no": self.page_no,
            "children": [c.to_dict() for c in self.children],
        }
        if self.level == 1:
            d["filename"] = self.filename
        return d


def build_tree(sections: list[Section], filenames: list[str]) -> list[TreeNode]:
    """Build the hierarchical section tree from the flat heading sequence.

    Uses a stack indexed by level so that each level-2 node is parented to the
    preceding level-1 node and each level-3 node to the preceding level-2 node.
    """
    roots: list[TreeNode] = []
    # stack[i] holds the current ancestor at level (i + 1).
    stack: list[TreeNode] = []
    h1_index = 0

    for section in sections:
        # The H1 node itself.
        node = TreeNode(section.heading, filenames[h1_index])
        h1_index += 1
        roots.append(node)
        stack = [node]

        for entry in section.entries:
            if not isinstance(entry, Heading):
                continue
            child = TreeNode(entry, None)
            level = entry.level
            # Truncate the stack to hold only ancestors of this level.
            while len(stack) >= level:
                stack.pop()
            stack[-1].children.append(child)
            # A level-3 node cannot have children, so do not push it.
            if level < 3:
                stack.append(child)

    return roots


# --- Rendering ---------------------------------------------------------------

def render_section_file(section: Section, index: int, total: int,
                        filenames: list[str]) -> str:
    """Render a single H1 section to its Markdown content."""
    lines: list[str] = []

    # First Markdown heading line is the H1 heading (full text).
    lines.append(f"# {section.heading.title}")
    lines.append("")

    # Navigation links.
    nav: list[str] = ["[Index](../index.md)"]
    if index > 0:
        nav.append(f"[Previous]({filenames[index - 1]})")
    if index < total - 1:
        nav.append(f"[Next]({filenames[index + 1]})")
    lines.append(" ".join(nav))
    lines.append("")

    # Descendant headings and body content, in reading order.
    for entry in section.entries:
        if isinstance(entry, Heading):
            lines.append("#" * entry.level + " " + entry.title)
            lines.append("")
        else:
            lines.append(entry)
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def render_index(title: str, sections: list[Section],
                 filenames: list[str]) -> str:
    """Render the root ``index.md`` with one link per H1 section."""
    lines: list[str] = []
    if title:
        lines.append(f"# {title}")
        lines.append("")
    for i, section in enumerate(sections):
        lines.append(f"[{section.heading.title}](sections/{filenames[i]})")
    return "\n".join(lines).rstrip() + "\n"


# --- Orchestration -----------------------------------------------------------

def main() -> None:
    title, sections = parse_document()

    # Deterministic filenames: <NN>-<slug>.md, 1-based, zero-padded to 2.
    filenames = [
        f"{i:02d}-{slug(section.heading.title)}" + ".md"
        for i, section in enumerate(sections, start=1)
    ]

    # (Re)create the output directories deterministically.
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    SECTIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Section files.
    total = len(sections)
    for i, section in enumerate(sections):
        content = render_section_file(section, i, total, filenames)
        (SECTIONS_DIR / filenames[i]).write_text(content, encoding="utf-8")

    # Root index.
    (OUTPUT_DIR / "index.md").write_text(
        render_index(title, sections, filenames), encoding="utf-8"
    )

    # Hierarchical table of contents.
    roots = build_tree(sections, filenames)
    toc = {"title": title, "sections": [node.to_dict() for node in roots]}
    (OUTPUT_DIR / "toc.json").write_text(
        json.dumps(toc, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()