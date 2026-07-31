"""RCP/1.0 format plugin for Docling.

Exposes ``build_converter()`` which returns a ``DocumentConverter`` that:
- converts ``.rcp`` files and streams,
- still converts Markdown (``.md``),
- reports failure (not exception) for malformed RCP,
- does not report success for any other format.
"""

from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path
from typing import Optional, Union

from docling.backend.abstract_backend import DeclarativeDocumentBackend
from docling.datamodel.base_models import (
    FormatToExtensions,
    FormatToMimeType,
    InputFormat,
    MimeTypeToFormat,
)
from docling.datamodel.document import InputDocument
from docling.document_converter import DocumentConverter, FormatOption
from docling.pipeline.simple_pipeline import SimplePipeline

from docling_core.types.doc import (
    DocItemLabel,
    DoclingDocument,
    TableCell,
    TableData,
)

# ---------------------------------------------------------------------------
# RCP format constants
# ---------------------------------------------------------------------------

_RCP_MAGIC = "%RCP/1.0"
_RCP_HEADER_TERMINATOR = "%%"
_RCP_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")

# Mapping from body-line prefix to marker type (for validation)
_BODY_MARKERS = {"S", "P", "N", "B", "A", "F"}

# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _parse_rcp_header(lines: list[str]) -> dict[str, str]:
    """Parse the RCP header block from lines (between magic and %%).

    Returns a dict of key -> value. Raises ValueError on any malformation.
    """
    header: dict[str, str] = {}
    for i, line in enumerate(lines, start=2):  # 1-indexed, line 1 is magic
        stripped = line.rstrip("\n")
        if "=" not in stripped:
            raise ValueError(
                f"Malformed header line {i}: expected key=value, got: {stripped!r}"
            )
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip()
        if not _RCP_KEY_RE.match(key):
            raise ValueError(
                f"Invalid header key at line {i}: {key!r}"
            )
        if key in header:
            raise ValueError(f"Duplicate header key at line {i}: {key!r}")
        header[key] = value

    # Validate required keys
    if "id" not in header or not header["id"]:
        raise ValueError("Missing or empty required header key: id")
    if "title" not in header or not header["title"]:
        raise ValueError("Missing or empty required header key: title")
    return header


def _parse_rcp_body(
    lines: list[str], start_idx: int
) -> list[dict]:
    """Parse the RCP body lines starting at *start_idx*.

    Returns a list of "blocks", each a dict:
        {"type": "heading", "level": int, "text": str}
        {"type": "paragraph", "text": str}
        {"type": "ordered_list", "items": [str, ...]}
        {"type": "unordered_list", "items": [str, ...]}
        {"type": "annotation", "text": str}
        {"type": "figure", "ref": str, "caption": str}
        {"type": "table", "rows": [[str, ...], ...]}

    Raises ValueError on any malformation.
    """
    blocks: list[dict] = []
    i = start_idx
    n = len(lines)

    while i < n:
        line = lines[i].rstrip("\n")

        # Blank lines are separators
        if line.strip() == "":
            i += 1
            continue

        # Table rows (lines starting with |)
        if line.startswith("|"):
            rows: list[list[str]] = []
            while i < n and lines[i].rstrip("\n").startswith("|"):
                raw = lines[i].rstrip("\n")
                # Drop leading |
                cell_str = raw[1:]
                # Drop one trailing | if present
                if cell_str.endswith("|"):
                    cell_str = cell_str[:-1]
                cells = [c.strip() for c in cell_str.split("|")]
                rows.append(cells)
                i += 1
            # Validate consistent column count
            if rows:
                ncols = len(rows[0])
                for r_idx, row in enumerate(rows):
                    if len(row) != ncols:
                        raise ValueError(
                            f"Ragged table: row {r_idx + 1} has {len(row)} cells, "
                            f"expected {ncols}"
                        )
                blocks.append({"type": "table", "rows": rows})
            continue

        # Figure reference
        if line.startswith("F>"):
            content = line[2:].strip()
            if " :: " not in content:
                raise ValueError(f"Invalid figure line: {line!r}")
            ref, _, caption = content.partition(" :: ")
            blocks.append({"type": "figure", "ref": ref.strip(), "caption": caption.strip()})
            i += 1
            continue

        # Heading
        m = re.match(r"^S([1-6])>\s+(.*)", line)
        if m:
            level = int(m.group(1))
            text = m.group(2)
            blocks.append({"type": "heading", "level": level, "text": text})
            i += 1
            continue

        # Paragraph
        m = re.match(r"^P>\s+(.*)", line)
        if m:
            blocks.append({"type": "paragraph", "text": m.group(1)})
            i += 1
            continue

        # Annotation
        m = re.match(r"^A>\s+(.*)", line)
        if m:
            blocks.append({"type": "annotation", "text": m.group(1)})
            i += 1
            continue

        # Ordered list (N> lines — consecutive)
        if line.startswith("N>"):
            items: list[str] = []
            while i < n and lines[i].rstrip("\n").startswith("N>"):
                m2 = re.match(r"^N>\s+(.*)", lines[i].rstrip("\n"))
                if not m2:
                    raise ValueError(f"Invalid ordered list line: {lines[i]!r}")
                items.append(m2.group(1))
                i += 1
            blocks.append({"type": "ordered_list", "items": items})
            continue

        # Bullet list (B> lines — consecutive)
        if line.startswith("B>"):
            items = []
            while i < n and lines[i].rstrip("\n").startswith("B>"):
                m2 = re.match(r"^B>\s+(.*)", lines[i].rstrip("\n"))
                if not m2:
                    raise ValueError(f"Invalid bullet list line: {lines[i]!r}")
                items.append(m2.group(1))
                i += 1
            blocks.append({"type": "unordered_list", "items": items})
            continue

        # Unknown marker
        raise ValueError(f"Unrecognized body line: {line!r}")

    return blocks


def _parse_rcp(content: str) -> tuple[dict[str, str], list[dict]]:
    """Parse a full RCP document string.

    Returns (header_dict, body_blocks). Raises ValueError on malformation.
    """
    lines = content.splitlines(keepends=True)
    if not lines:
        raise ValueError("Empty file")

    # Check magic line
    first = lines[0].rstrip("\n")
    if first != _RCP_MAGIC:
        raise ValueError(f"Bad magic line: expected {_RCP_MAGIC!r}, got {first!r}")

    # Find the %% terminator
    term_idx = None
    for idx, line in enumerate(lines):
        if idx >= 1 and line.rstrip("\n") == _RCP_HEADER_TERMINATOR:
            term_idx = idx
            break
    if term_idx is None:
        raise ValueError("Header block never terminated (missing %%)")

    # Parse header (lines 1..term_idx-1, 1-indexed)
    header = _parse_rcp_header(lines[1:term_idx])

    # Parse body
    body = _parse_rcp_body(lines, term_idx + 1)

    return header, body


# ---------------------------------------------------------------------------
# RCP Document Backend
# ---------------------------------------------------------------------------


class RcpDocumentBackend(DeclarativeDocumentBackend):
    """Backend that parses RCP/1.0 text and builds a DoclingDocument."""

    def __init__(
        self,
        in_doc: InputDocument,
        path_or_stream: Union[BytesIO, Path],
        options=None,
    ):
        super().__init__(in_doc, path_or_stream, options)
        self._raw_content: Optional[str] = None
        self._parse_error: Optional[str] = None
        self._header: Optional[dict[str, str]] = None
        self._body: Optional[list[dict]] = None

        # Read the content
        try:
            if isinstance(path_or_stream, Path):
                raw_bytes = path_or_stream.read_bytes()
            else:
                # The stream position may have been consumed by create_file_hash
                # in InputDocument.__init__ — seek back to the beginning.
                path_or_stream.seek(0)
                raw_bytes = path_or_stream.read()
            self._raw_content = raw_bytes.decode("utf-8")
        except Exception as e:
            self._parse_error = str(e)
            return

        # Parse
        try:
            self._header, self._body = _parse_rcp(self._raw_content)
        except ValueError as e:
            self._parse_error = str(e)

    def is_valid(self) -> bool:
        return self._parse_error is None

    @classmethod
    def supports_pagination(cls) -> bool:
        return False

    @classmethod
    def supported_formats(cls) -> set[InputFormat]:
        return {InputFormat.BOXNOTE}

    def convert(self) -> DoclingDocument:
        if self._parse_error is not None:
            raise ValueError(self._parse_error)

        assert self._header is not None
        assert self._body is not None

        doc_id = self._header["id"]
        doc = DoclingDocument(name=doc_id)

        # Title
        doc.add_title(text=self._header["title"])

        # Track the current heading hierarchy
        # heading_stack: list of (level, SectionHeaderItem)
        heading_stack: list[tuple[int, object]] = []

        def _current_parent():
            if heading_stack:
                return heading_stack[-1][1]
            return doc.body

        for block in self._body:
            btype = block["type"]

            if btype == "heading":
                level = block["level"]
                text = block["text"]
                # Pop headings that are >= this level
                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()
                parent = _current_parent()
                h = doc.add_heading(text=text, level=level, parent=parent)
                heading_stack.append((level, h))

            elif btype == "paragraph":
                doc.add_text(
                    label=DocItemLabel.TEXT,
                    text=block["text"],
                    parent=_current_parent(),
                )

            elif btype == "annotation":
                doc.add_text(
                    label=DocItemLabel.TEXT,
                    text=f"NOTE: {block['text']}",
                    parent=_current_parent(),
                )

            elif btype == "ordered_list":
                parent = _current_parent()
                lg = doc.add_list_group(parent=parent, ordered=True)
                for item_text in block["items"]:
                    doc.add_list_item(
                        text=item_text,
                        enumerated=True,
                        parent=lg,
                    )

            elif btype == "unordered_list":
                parent = _current_parent()
                lg = doc.add_list_group(parent=parent, ordered=False)
                for item_text in block["items"]:
                    doc.add_list_item(
                        text=item_text,
                        enumerated=False,
                        parent=lg,
                    )

            elif btype == "figure":
                caption_text = block["caption"]
                parent = _current_parent()
                # Create a caption TextItem first
                cap = doc.add_text(
                    label=DocItemLabel.CAPTION,
                    text=caption_text,
                )
                doc.add_picture(
                    caption=cap,
                    parent=parent,
                )

            elif btype == "table":
                rows = block["rows"]
                num_rows = len(rows)
                num_cols = len(rows[0])
                cells: list[TableCell] = []
                for r_idx, row in enumerate(rows):
                    for c_idx, cell_text in enumerate(row):
                        cells.append(
                            TableCell(
                                text=cell_text,
                                start_row_offset_idx=r_idx,
                                end_row_offset_idx=r_idx + 1,
                                start_col_offset_idx=c_idx,
                                end_col_offset_idx=c_idx + 1,
                                column_header=(r_idx == 0),
                            )
                        )
                table_data = TableData(
                    num_rows=num_rows,
                    num_cols=num_cols,
                    table_cells=cells,
                )
                doc.add_table(data=table_data, parent=_current_parent())

        return doc


# ---------------------------------------------------------------------------
# Plugin registration
# ---------------------------------------------------------------------------

# Monkey-patch the format registries so .rcp maps to InputFormat.BOXNOTE
# (we hijack BOXNOTE since it's unused for our purposes).
_RCP_EXTENSION = "rcp"
_RCP_MIME = "application/x-rcp"

# Register extension
if _RCP_EXTENSION not in FormatToExtensions.get(InputFormat.BOXNOTE, []):
    FormatToExtensions[InputFormat.BOXNOTE] = [_RCP_EXTENSION]

# Register MIME type
FormatToMimeType[InputFormat.BOXNOTE] = [_RCP_MIME]
MimeTypeToFormat[_RCP_MIME] = [InputFormat.BOXNOTE]


def build_converter() -> DocumentConverter:
    """Return a DocumentConverter that handles .rcp and .md files.

    The converter:
    - converts .rcp documents (filesystem path or DocumentStream),
    - converts .md documents,
    - reports failure for malformed .rcp (when raises_on_error=False),
    - does not report success for other formats.
    """
    return DocumentConverter(
        allowed_formats=[InputFormat.BOXNOTE, InputFormat.MD],
        format_options={
            InputFormat.BOXNOTE: FormatOption(
                pipeline_cls=SimplePipeline,
                backend=RcpDocumentBackend,
            ),
        },
    )
