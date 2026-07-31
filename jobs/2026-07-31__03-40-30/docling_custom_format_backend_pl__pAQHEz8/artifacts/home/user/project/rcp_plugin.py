"""Docling input-format plugin for the in-house RCP/1.0 protocol format.

This module teaches Docling how to read ``.rcp`` files (see the RCP/1.0
grammar in the project README) as a first-class input format, while still
allowing the same :class:`~docling.document_converter.DocumentConverter`
instance to convert natively supported Markdown (``.md``) documents.

The main entry point is :func:`build_converter`, which returns a configured
``DocumentConverter``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Optional, Union

from docling_core.types.doc import (
    DocItemLabel,
    DoclingDocument,
    DocumentOrigin,
    TableCell,
    TableData,
)

from docling.backend.abstract_backend import DeclarativeDocumentBackend
from docling.backend.md_backend import MarkdownDocumentBackend
from docling.datamodel.backend_options import BackendOptions, MarkdownBackendOptions
from docling.datamodel.base_models import FormatToExtensions, InputFormat
from docling.datamodel.document import InputDocument
from docling.document_converter import DocumentConverter, FormatOption
from docling.exceptions import DocumentLoadError
from docling.pipeline.simple_pipeline import SimplePipeline

# --------------------------------------------------------------------------
# Register the ".rcp" extension with Docling's format-guessing machinery.
# --------------------------------------------------------------------------
#
# Docling's ``DocumentConverter`` decides which ``InputFormat`` a given path
# or stream belongs to purely from filename extension / content sniffing
# (see ``docling.datamodel.document._DocumentConversionInput._guess_format``)
# before ever consulting the ``allowed_formats``/``format_options`` the
# converter was built with. ``InputFormat`` is a plain ``str`` Enum, so it
# cannot get a new ``RCP`` member without patching Docling internals in ways
# that would break ``isinstance``/serialization elsewhere.
#
# Instead, RCP documents are carried through Docling as ``InputFormat.MD``:
# the ``.rcp`` extension is registered as an extra Markdown extension (this
# is the same mechanism Docling already uses for ``.txt``, ``.qmd``, ...),
# and the backend registered for ``InputFormat.MD`` below inspects the
# filename to decide whether to run the RCP parser or delegate to the real
# Markdown backend.
def _register_rcp_extension() -> None:
    md_extensions = FormatToExtensions[InputFormat.MD]
    if "rcp" not in md_extensions:
        md_extensions.append("rcp")


_register_rcp_extension()


# --------------------------------------------------------------------------
# RCP/1.0 parsing
# --------------------------------------------------------------------------


class RcpFormatError(ValueError):
    """Raised when an ``.rcp`` document violates the RCP/1.0 grammar."""


_MAGIC_LINE = "%RCP/1.0"
_HEADER_TERMINATOR = "%%"

_HEADER_LINE_RE = re.compile(r"^([a-z][a-z0-9_]*)=(.*)$")
_HEADING_RE = re.compile(r"^S([1-6])> (.*)$")
_PARAGRAPH_RE = re.compile(r"^P> (.*)$")
_STEP_RE = re.compile(r"^N> (.*)$")
_BULLET_RE = re.compile(r"^B> (.*)$")
_ANNOTATION_RE = re.compile(r"^A> (.*)$")
_FIGURE_PREFIX = "F> "
_FIGURE_SEP = " :: "


@dataclass
class RcpEvent:
    kind: str
    text: str = ""
    level: int = 0
    enumerated: bool = False
    items: list = field(default_factory=list)
    rows: Optional[list] = None
    caption: str = ""


@dataclass
class RcpDocument:
    doc_id: str
    title: str
    events: list


def _parse_header(lines: list) -> tuple[dict, int]:
    header: dict = {}
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line == _HEADER_TERMINATOR:
            return header, i
        match = _HEADER_LINE_RE.match(line)
        if not match:
            raise RcpFormatError(f"Malformed header line: {line!r}")
        key, raw_value = match.group(1), match.group(2)
        if key in header:
            raise RcpFormatError(f"Duplicate header key: {key!r}")
        header[key] = raw_value.strip()
        i += 1
    raise RcpFormatError("Unterminated header block (missing '%%' line)")


def _classify_table_row(line: str) -> list:
    body = line[1:]
    if body.endswith("|"):
        body = body[:-1]
    return [cell.strip() for cell in body.split("|")]


def _parse_body(lines: list) -> list:
    events: list = []
    current: Optional[RcpEvent] = None

    def close_current() -> None:
        nonlocal current
        if current is not None:
            events.append(current)
            current = None

    for line in lines:
        if line.strip() == "":
            close_current()
            continue

        m = _HEADING_RE.match(line)
        if m:
            close_current()
            events.append(RcpEvent(kind="heading", level=int(m.group(1)), text=m.group(2)))
            continue

        m = _PARAGRAPH_RE.match(line)
        if m:
            close_current()
            events.append(RcpEvent(kind="paragraph", text=m.group(1)))
            continue

        m = _ANNOTATION_RE.match(line)
        if m:
            close_current()
            events.append(RcpEvent(kind="annotation", text=m.group(1)))
            continue

        m = _STEP_RE.match(line)
        if m:
            if current is not None and current.kind == "list" and current.enumerated:
                current.items.append(m.group(1))
            else:
                close_current()
                current = RcpEvent(kind="list", enumerated=True, items=[m.group(1)])
            continue

        m = _BULLET_RE.match(line)
        if m:
            if current is not None and current.kind == "list" and not current.enumerated:
                current.items.append(m.group(1))
            else:
                close_current()
                current = RcpEvent(kind="list", enumerated=False, items=[m.group(1)])
            continue

        if line.startswith(_FIGURE_PREFIX):
            rest = line[len(_FIGURE_PREFIX) :]
            if _FIGURE_SEP not in rest:
                raise RcpFormatError(f"Malformed figure line: {line!r}")
            _ref, caption = rest.split(_FIGURE_SEP, 1)
            close_current()
            events.append(RcpEvent(kind="figure", caption=caption))
            continue

        if line.startswith("|"):
            cells = _classify_table_row(line)
            if current is not None and current.kind == "table":
                if len(cells) != len(current.rows[0]):
                    raise RcpFormatError(f"Ragged table row: {line!r}")
                current.rows.append(cells)
            else:
                close_current()
                current = RcpEvent(kind="table", rows=[cells])
            continue

        raise RcpFormatError(f"Unrecognized body line: {line!r}")

    close_current()
    return events


def parse_rcp(text: str) -> RcpDocument:
    """Parse the full text of an ``.rcp`` file.

    Raises :class:`RcpFormatError` if the document violates the RCP/1.0
    grammar in any way.
    """
    lines = text.split("\n")
    # A trailing newline produces one trailing empty element that does not
    # correspond to an actual line in the file; drop it.
    if lines and lines[-1] == "":
        lines.pop()

    if not lines or lines[0] != _MAGIC_LINE:
        raise RcpFormatError("Missing or invalid '%RCP/1.0' magic line")

    header, terminator_idx = _parse_header(lines[1:])
    body_lines = lines[1:][terminator_idx + 1 :]

    doc_id = header.get("id")
    title = header.get("title")
    if not doc_id:
        raise RcpFormatError("Missing or empty required header key 'id'")
    if not title:
        raise RcpFormatError("Missing or empty required header key 'title'")

    events = _parse_body(body_lines)
    return RcpDocument(doc_id=doc_id, title=title, events=events)


# --------------------------------------------------------------------------
# RCP -> DoclingDocument
# --------------------------------------------------------------------------


def build_rcp_docling_document(
    rcp_doc: RcpDocument, filename: str, document_hash: Any
) -> DoclingDocument:
    origin = DocumentOrigin(
        filename=filename,
        mimetype="text/plain",
        binary_hash=document_hash,
    )
    doc = DoclingDocument(name=rcp_doc.doc_id, origin=origin)
    doc.add_title(rcp_doc.title)

    # Stack of (level, node) for currently open section headings, used to
    # nest headings and content under the closest preceding heading of a
    # smaller level.
    heading_stack: list = []

    def current_parent():
        return heading_stack[-1][1] if heading_stack else None

    for ev in rcp_doc.events:
        if ev.kind == "heading":
            while heading_stack and heading_stack[-1][0] >= ev.level:
                heading_stack.pop()
            parent = current_parent()
            node = doc.add_heading(text=ev.text, level=ev.level, parent=parent)
            heading_stack.append((ev.level, node))

        elif ev.kind == "paragraph":
            doc.add_text(label=DocItemLabel.TEXT, text=ev.text, parent=current_parent())

        elif ev.kind == "annotation":
            doc.add_text(
                label=DocItemLabel.TEXT,
                text=f"NOTE: {ev.text}",
                parent=current_parent(),
            )

        elif ev.kind == "list":
            group = doc.add_list_group(parent=current_parent())
            for item_text in ev.items:
                doc.add_list_item(item_text, enumerated=ev.enumerated, parent=group)

        elif ev.kind == "table":
            rows = ev.rows or []
            num_rows = len(rows)
            num_cols = len(rows[0]) if rows else 0
            table_data = TableData(num_rows=num_rows, num_cols=num_cols, table_cells=[])
            for row_idx, row in enumerate(rows):
                for col_idx, cell_text in enumerate(row):
                    table_data.table_cells.append(
                        TableCell(
                            text=cell_text,
                            row_span=1,
                            col_span=1,
                            start_row_offset_idx=row_idx,
                            end_row_offset_idx=row_idx + 1,
                            start_col_offset_idx=col_idx,
                            end_col_offset_idx=col_idx + 1,
                            column_header=(row_idx == 0),
                            row_header=False,
                        )
                    )
            doc.add_table(data=table_data, parent=current_parent())

        elif ev.kind == "figure":
            picture = doc.add_picture(parent=current_parent())
            caption_item = doc.add_text(
                label=DocItemLabel.CAPTION, text=ev.caption, parent=picture
            )
            picture.captions.append(caption_item.get_ref())

        else:  # pragma: no cover - defensive, cannot happen
            raise RcpFormatError(f"Unknown RCP event kind: {ev.kind!r}")

    return doc


# --------------------------------------------------------------------------
# Docling backend
# --------------------------------------------------------------------------


def _read_text(path_or_stream: Union[BytesIO, Path]) -> str:
    if isinstance(path_or_stream, Path):
        return path_or_stream.read_text(encoding="utf-8")
    return path_or_stream.getvalue().decode("utf-8")


class RcpOrMarkdownBackend(DeclarativeDocumentBackend):
    """Backend registered for ``InputFormat.MD`` that dispatches on filename.

    Files named ``*.rcp`` are parsed as RCP/1.0 documents. Every other file
    (in practice, real Markdown files) is delegated to Docling's own
    :class:`~docling.backend.md_backend.MarkdownDocumentBackend`, so genuine
    Markdown conversion behaves exactly as it does out of the box.
    """

    def __init__(
        self,
        in_doc: "InputDocument",
        path_or_stream: Union[BytesIO, Path],
        options: Optional[BackendOptions] = None,
    ) -> None:
        super().__init__(in_doc, path_or_stream, options)

        self._is_rcp = self.file.name.lower().endswith(".rcp")
        self._valid = True
        self._rcp_doc: Optional[RcpDocument] = None
        self._md_backend: Optional[MarkdownDocumentBackend] = None

        if self._is_rcp:
            try:
                text = _read_text(path_or_stream)
                self._rcp_doc = parse_rcp(text)
            except RcpFormatError:
                self._valid = False
            except Exception as exc:  # noqa: BLE001 - never let this escape
                raise DocumentLoadError(
                    f"RCP backend could not read document with hash "
                    f"{self.document_hash}"
                ) from exc
        else:
            md_options: Optional[MarkdownBackendOptions] = (
                options if isinstance(options, MarkdownBackendOptions) else None
            )
            self._md_backend = MarkdownDocumentBackend(
                in_doc, path_or_stream, md_options
            )
            self._valid = self._md_backend.is_valid()

    def is_valid(self) -> bool:
        return self._valid

    @classmethod
    def supports_pagination(cls) -> bool:
        return False

    def unload(self) -> None:
        if self._md_backend is not None:
            self._md_backend.unload()
        super().unload()

    @classmethod
    def supported_formats(cls) -> set:
        return {InputFormat.MD}

    def convert(self) -> DoclingDocument:
        if not self._valid:
            raise RcpFormatError(f"Malformed RCP document: {self.file.name}")

        if self._is_rcp:
            assert self._rcp_doc is not None
            return build_rcp_docling_document(
                self._rcp_doc, self.file.name, self.document_hash
            )

        assert self._md_backend is not None
        return self._md_backend.convert()


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------


def build_converter() -> DocumentConverter:
    """Build a :class:`DocumentConverter` that understands RCP/1.0 and MD.

    The returned converter accepts ``.rcp`` documents (as filesystem paths or
    in-memory ``DocumentStream``s named ``*.rcp``) and natively supported
    Markdown (``.md``) documents, and no other input format.
    """
    _register_rcp_extension()

    format_option = FormatOption(
        pipeline_cls=SimplePipeline,
        backend=RcpOrMarkdownBackend,
    )
    return DocumentConverter(
        allowed_formats=[InputFormat.MD],
        format_options={InputFormat.MD: format_option},
    )
