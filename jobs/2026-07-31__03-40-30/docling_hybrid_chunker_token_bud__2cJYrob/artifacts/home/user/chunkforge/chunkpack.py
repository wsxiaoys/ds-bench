#!/usr/bin/env python3
"""chunkpack.py -- Token-budget-aware chunk packing for retrieval.

Converts a local, heterogeneous document corpus (markdown, html, docx, pdf)
into embedding-ready, token-budgeted, contextualized chunks using a fully
offline Docling conversion pipeline and a baked-in HuggingFace tokenizer.

Subcommands:
    pack    --corpus <dir> --out <dir> --max-tokens <int> [--no-merge-peers]
    verify  --out <dir>

See the accompanying task description for the full behavioural contract.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
TOKENIZER_DIR = SCRIPT_DIR / "assets" / "tokenizer"

SUPPORTED_EXTENSIONS = {".md", ".html", ".docx", ".pdf"}

REQUIRED_CHUNK_KEYS = {
    "chunk_id",
    "index",
    "source",
    "ordinal",
    "heading_path",
    "page_numbers",
    "token_count",
    "is_partial_element",
    "text",
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def error_exit(message: str, code: int = 2) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(code)


def make_text(heading_path, body: str) -> str:
    """Build the contextualized chunk text from a heading path and a body."""
    if heading_path:
        return "\n".join(heading_path) + "\n" + body
    return body


# ---------------------------------------------------------------------------
# Tokenizer wrapper
# ---------------------------------------------------------------------------


class Tokenizer:
    def __init__(self, tokenizer_dir: str):
        # Imported lazily so that --help / argument errors don't pay the
        # (heavy) import cost of transformers.
        from transformers import AutoTokenizer

        self.path = os.path.abspath(tokenizer_dir)
        self._tok = AutoTokenizer.from_pretrained(self.path)

    def count_tokens(self, text: str) -> int:
        if not text:
            return 0
        return len(self._tok.tokenize(text))


# ---------------------------------------------------------------------------
# Source discovery
# ---------------------------------------------------------------------------


def discover_sources(corpus_dir: Path):
    """Recursively discover corpus files.

    Returns (supported, skipped) where `supported` is a list of
    (relative_posix_path, absolute_path) tuples sorted ascending by
    relative_posix_path, and `skipped` is a sorted list of relative posix
    paths for files with unsupported extensions.
    """
    supported = []
    skipped = []
    for root, _dirs, files in os.walk(corpus_dir):
        for fname in files:
            abs_path = Path(root) / fname
            rel_posix = abs_path.relative_to(corpus_dir).as_posix()
            ext = abs_path.suffix.lower()
            if ext in SUPPORTED_EXTENSIONS:
                supported.append((rel_posix, abs_path))
            else:
                skipped.append(rel_posix)
    supported.sort(key=lambda t: t[0])
    skipped.sort()
    return supported, skipped


# ---------------------------------------------------------------------------
# Document conversion + element-level (heading-aware) extraction
# ---------------------------------------------------------------------------


def _serialize_table(table_item) -> str:
    """Serialize a table so that every cell's words are guaranteed present.

    Each grid row becomes one line, cells joined with " | ". This is
    intentionally simple (and slightly redundant for spanned cells) in order
    to guarantee that no cell content -- including header cells -- is ever
    dropped, which the default docling table serializer does not guarantee
    (it omits corner/header cells that aren't paired with a data cell).
    """
    lines = []
    grid = table_item.data.grid
    for row in grid:
        seen_ids = set()
        cell_texts = []
        for cell in row:
            text = (cell.text or "").strip()
            if not text:
                continue
            if id(cell) in seen_ids:
                continue
            seen_ids.add(id(cell))
            cell_texts.append(text)
        if cell_texts:
            lines.append(" | ".join(cell_texts))
    return "\n".join(lines)


def get_raw_elements(doc):
    """Return the ordered, heading-aware element chunks of a DoclingDocument.

    Each element is a dict with keys: heading_path (list[str]), doc_items
    (list[DocItem]), text (str). Table elements are re-serialized so that no
    cell content (including header cells) can be dropped.
    """
    from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker
    from docling_core.types.doc.items.table.table import TableItem

    hc = HierarchicalChunker()
    elements = []
    for doc_chunk in hc.chunk(doc):
        heading_path = list(doc_chunk.meta.headings) if doc_chunk.meta.headings else []
        doc_items = list(doc_chunk.meta.doc_items)
        if len(doc_items) == 1 and isinstance(doc_items[0], TableItem):
            text = _serialize_table(doc_items[0])
        else:
            text = doc_chunk.text
        if not text or not text.strip():
            continue
        elements.append({"heading_path": heading_path, "doc_items": doc_items, "text": text})
    return elements


def _page_numbers_of(doc_items) -> list:
    pages = set()
    for item in doc_items:
        for prov in getattr(item, "prov", []) or []:
            pages.add(prov.page_no)
    return sorted(pages)


def _split_body_to_budget(heading_path, body: str, max_tokens: int, tokenizer: Tokenizer):
    """Greedily split `body` on whitespace boundaries into pieces such that
    make_text(heading_path, piece) always tokenizes to <= max_tokens tokens.

    We are guaranteed (per task spec) that for max_tokens >= 32 the heading
    prefix plus a single body word always fits, so termination is
    guaranteed.
    """
    words = body.split()
    pieces = []
    i = 0
    n = len(words)
    while i < n:
        lo, hi = i + 1, n
        best = i + 1  # always take at least one word
        while lo <= hi:
            mid = (lo + hi) // 2
            candidate_body = " ".join(words[i:mid])
            candidate_text = make_text(heading_path, candidate_body)
            if tokenizer.count_tokens(candidate_text) <= max_tokens:
                best = mid
                lo = mid + 1
            else:
                hi = mid - 1
        pieces.append(" ".join(words[i:best]))
        i = best
    return pieces


def build_chunks_for_document(source: str, doc, max_tokens: int, merge_peers: bool, tokenizer: Tokenizer):
    """Build the final chunk records (without chunk_id/index) for one source
    document, in reading order.
    """
    elements = get_raw_elements(doc)

    # Step 1: group elements, merging consecutive same-heading elements that
    # fit together within the budget (when merge_peers is enabled).
    groups = []  # list of dict(heading_path, bodies=[...], doc_items=[...])
    current = None
    for el in elements:
        if current is not None and merge_peers and current["heading_path"] == el["heading_path"]:
            candidate_body = "\n".join(current["bodies"] + [el["text"]])
            candidate_text = make_text(el["heading_path"], candidate_body)
            if tokenizer.count_tokens(candidate_text) <= max_tokens:
                current["bodies"].append(el["text"])
                current["doc_items"].extend(el["doc_items"])
                continue
        # flush current, start new
        if current is not None:
            groups.append(current)
        current = {
            "heading_path": el["heading_path"],
            "bodies": [el["text"]],
            "doc_items": list(el["doc_items"]),
        }
    if current is not None:
        groups.append(current)

    # Step 2: turn groups into final chunk records, splitting any group that
    # still exceeds the budget (this can only happen for an unmerged, single
    # oversized element).
    records = []
    for group in groups:
        heading_path = group["heading_path"]
        body = "\n".join(group["bodies"])
        text = make_text(heading_path, body)
        token_count = tokenizer.count_tokens(text)
        page_numbers = _page_numbers_of(group["doc_items"])
        if token_count <= max_tokens:
            records.append(
                {
                    "heading_path": heading_path,
                    "page_numbers": page_numbers,
                    "token_count": token_count,
                    "is_partial_element": False,
                    "text": text,
                }
            )
        else:
            pieces = _split_body_to_budget(heading_path, body, max_tokens, tokenizer)
            for piece in pieces:
                piece_text = make_text(heading_path, piece)
                records.append(
                    {
                        "heading_path": heading_path,
                        "page_numbers": page_numbers,
                        "token_count": tokenizer.count_tokens(piece_text),
                        "is_partial_element": True,
                        "text": piece_text,
                    }
                )

    for ordinal, rec in enumerate(records):
        rec["ordinal"] = ordinal
        rec["source"] = source
        rec["chunk_id"] = f"{source}#{ordinal:04d}"

    return records


# ---------------------------------------------------------------------------
# pack
# ---------------------------------------------------------------------------


def cmd_pack(args) -> int:
    corpus_dir = Path(args.corpus)
    if not corpus_dir.is_dir():
        error_exit(f"corpus directory does not exist: {args.corpus}")

    raw = str(args.max_tokens).strip()
    if not re.fullmatch(r"[+-]?\d+", raw):
        error_exit(f"--max-tokens must be an integer of at least 32, got {args.max_tokens!r}")
        return 2
    max_tokens = int(raw)
    if max_tokens < 32:
        error_exit(f"--max-tokens must be an integer of at least 32, got {max_tokens}")
        return 2

    merge_peers = not args.no_merge_peers

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    tokenizer = Tokenizer(str(TOKENIZER_DIR))

    supported, skipped = discover_sources(corpus_dir)

    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()

    all_records = []
    documents_summary = []

    for source, abs_path in supported:
        result = converter.convert(str(abs_path))
        doc = result.document
        records = build_chunks_for_document(source, doc, max_tokens, merge_peers, tokenizer)

        token_counts = [r["token_count"] for r in records]
        chunk_count = len(records)
        token_total = sum(token_counts)
        max_chunk_tokens = max(token_counts) if token_counts else 0
        mean_chunk_tokens = round(token_total / chunk_count, 2) if chunk_count else 0.0
        partial_chunk_count = sum(1 for r in records if r["is_partial_element"])
        max_heading_depth = max((len(r["heading_path"]) for r in records), default=0)
        doc_pages = sorted(set(p for r in records for p in r["page_numbers"]))

        documents_summary.append(
            {
                "source": source,
                "chunk_count": chunk_count,
                "token_total": token_total,
                "max_chunk_tokens": max_chunk_tokens,
                "mean_chunk_tokens": mean_chunk_tokens,
                "partial_chunk_count": partial_chunk_count,
                "max_heading_depth": max_heading_depth,
                "page_numbers": doc_pages,
            }
        )

        all_records.extend(records)

    # assign global index
    for idx, rec in enumerate(all_records):
        rec["index"] = idx

    chunks_path = out_dir / "chunks.jsonl"
    with open(chunks_path, "w", encoding="utf-8", newline="\n") as f:
        for rec in all_records:
            obj = {
                "chunk_id": rec["chunk_id"],
                "index": rec["index"],
                "source": rec["source"],
                "ordinal": rec["ordinal"],
                "heading_path": rec["heading_path"],
                "page_numbers": rec["page_numbers"],
                "token_count": rec["token_count"],
                "is_partial_element": rec["is_partial_element"],
                "text": rec["text"],
            }
            f.write(json.dumps(obj, ensure_ascii=False))
            f.write("\n")

    budget_violations = sum(1 for r in all_records if r["token_count"] > max_tokens)

    summary = {
        "tokenizer_path": tokenizer.path,
        "max_tokens": max_tokens,
        "merge_peers": merge_peers,
        "documents": documents_summary,
        "totals": {
            "document_count": len(documents_summary),
            "chunk_count": len(all_records),
            "token_total": sum(r["token_count"] for r in all_records),
            "partial_chunk_count": sum(1 for r in all_records if r["is_partial_element"]),
            "budget_violations": budget_violations,
        },
        "skipped_files": skipped,
    }

    summary_path = out_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(
        f"PACKED documents={summary['totals']['document_count']} "
        f"chunks={summary['totals']['chunk_count']} "
        f"max_tokens={max_tokens} "
        f"merge_peers={'true' if merge_peers else 'false'}"
    )
    return 0


# ---------------------------------------------------------------------------
# verify
# ---------------------------------------------------------------------------


def cmd_verify(args) -> int:
    out_dir = Path(args.out)
    chunks_path = out_dir / "chunks.jsonl"
    summary_path = out_dir / "summary.json"

    if not chunks_path.is_file() or not summary_path.is_file():
        error_exit(f"missing chunks.jsonl or summary.json in {args.out}")

    violations = []

    try:
        with open(summary_path, "r", encoding="utf-8") as f:
            summary = json.load(f)
        max_tokens = int(summary["max_tokens"])
        tokenizer_path = summary["tokenizer_path"]
    except Exception as e:
        print(f"VIOLATION: could not read summary.json: {e}", file=sys.stderr)
        return 3

    try:
        tokenizer = Tokenizer(tokenizer_path)
    except Exception as e:
        print(f"VIOLATION: could not load tokenizer from {tokenizer_path}: {e}", file=sys.stderr)
        return 3

    expected_ordinal = {}
    seen_index = -1

    with open(chunks_path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.rstrip("\n")
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception as e:
                violations.append(f"line {line_no}: invalid JSON: {e}")
                continue

            if not isinstance(obj, dict) or set(obj.keys()) != REQUIRED_CHUNK_KEYS:
                violations.append(f"line {line_no}: does not have exactly the required nine keys")
                continue

            # index forms 0..N-1 ascending
            seen_index += 1
            if obj["index"] != seen_index:
                violations.append(
                    f"line {line_no}: index {obj['index']} does not match expected {seen_index}"
                )

            # per-source ordinal forms 0..k-1 ascending
            source = obj["source"]
            ordinal = obj["ordinal"]
            expected = expected_ordinal.get(source, 0)
            if ordinal != expected:
                violations.append(
                    f"line {line_no}: ordinal {ordinal} for source {source!r} does not match expected {expected}"
                )
            expected_ordinal[source] = expected + 1

            # chunk_id matches source/ordinal spelling
            expected_chunk_id = f"{source}#{ordinal:04d}"
            if obj["chunk_id"] != expected_chunk_id:
                violations.append(
                    f"line {line_no}: chunk_id {obj['chunk_id']!r} does not match expected {expected_chunk_id!r}"
                )

            # token_count equals a freshly computed count, and within budget
            recomputed = tokenizer.count_tokens(obj["text"])
            if recomputed != obj["token_count"]:
                violations.append(
                    f"line {line_no}: token_count {obj['token_count']} does not match recomputed {recomputed}"
                )
            if not (0 < obj["token_count"] <= max_tokens):
                violations.append(
                    f"line {line_no}: token_count {obj['token_count']} violates budget (max_tokens={max_tokens})"
                )

    if violations:
        for v in violations:
            print(f"VIOLATION: {v}", file=sys.stderr)
        return 3

    print(f"VERIFIED chunks={seen_index + 1} max_tokens={max_tokens}")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_arg_parser():
    parser = argparse.ArgumentParser(prog="chunkpack.py", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_pack = sub.add_parser("pack")
    p_pack.add_argument("--corpus", required=True)
    p_pack.add_argument("--out", required=True)
    p_pack.add_argument("--max-tokens", required=True)
    p_pack.add_argument("--no-merge-peers", action="store_true")

    p_verify = sub.add_parser("verify")
    p_verify.add_argument("--out", required=True)

    return parser


def main(argv=None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if args.command == "pack":
        return cmd_pack(args)
    elif args.command == "verify":
        return cmd_verify(args)
    else:
        parser.print_help(sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
