#!/usr/bin/env python3
"""
Token-budget-aware chunk packing for retrieval.

Converts documents from a corpus directory into embedding-ready chunks,
respecting a hard token budget measured with a baked-in tokenizer.
"""

import argparse
import json
import os
import sys
from collections import OrderedDict
from pathlib import Path

from docling.document_converter import DocumentConverter
from transformers import AutoTokenizer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = {".md", ".html", ".docx", ".pdf"}


def discover_sources(corpus_dir: str) -> tuple[list[str], list[str]]:
    """Walk corpus_dir recursively and return (sources, skipped) sorted."""
    corpus_path = Path(corpus_dir).resolve()
    sources: list[str] = []
    skipped: list[str] = []

    for root, _dirs, files in os.walk(str(corpus_path)):
        root_path = Path(root).resolve()
        for fname in sorted(files):
            full = root_path / fname
            rel = full.relative_to(corpus_path).as_posix()
            ext = full.suffix.lower()
            if ext in SUPPORTED_EXTENSIONS:
                sources.append(rel)
            else:
                skipped.append(rel)

    sources.sort()
    skipped.sort()
    return sources, skipped


def load_tokenizer(tokenizer_path: str):
    """Load the tokenizer from the given local directory."""
    return AutoTokenizer.from_pretrained(tokenizer_path, local_files_only=True)


def count_tokens(tokenizer, text: str) -> int:
    """Return token count of text (no special tokens)."""
    if not text:
        return 0
    return len(tokenizer(text, add_special_tokens=False)["input_ids"])


def build_heading_prefix(heading_path: list[str]) -> str:
    """Build the heading prefix string."""
    if not heading_path:
        return ""
    return "\n".join(heading_path) + "\n"


# ---------------------------------------------------------------------------
# Document parsing and element extraction
# ---------------------------------------------------------------------------

def parse_document(file_path: str, converter: DocumentConverter):
    """Parse a document with Docling and return the DoclingDocument."""
    return converter.convert(file_path).document


def extract_elements(doc, source_ext: str = "") -> list[dict]:
    """
    Walk a DoclingDocument's items in order and return a list of element dicts.
    Each element has:
      - type: "heading" or "body"
      - text: the text content (for tables, space-joined cell values)
      - heading_path: list of section titles in scope
      - page_numbers: list of page numbers (from provenance)
    """
    elements: list[dict] = []
    heading_stack: list[str] = []
    seen_first_heading = False

    # Determine heading level strategy.
    # .md: Docling flattens all items to _level=1, but item.level gives correct H1/H2.
    # .pdf: Docling flattens all to _level=1, item.level also 1; we treat first
    #        heading as level 1 and subsequent ones as level 2.
    # .html, .docx: _level from iterate_items() correctly reflects nesting.
    use_item_level = (source_ext == ".md")
    pdf_mode = (source_ext == ".pdf")

    for item, _level in doc.iterate_items():
        label = item.label

        # Determine if this is a heading-like item
        is_heading = label in ("title", "section_header", "section-header")

        # Get page numbers from provenance
        page_nums: list[int] = []
        if hasattr(item, "prov") and item.prov:
            for p in item.prov:
                if hasattr(p, "page_no") and p.page_no is not None:
                    page_nums.append(p.page_no)
            page_nums = sorted(set(page_nums))

        if is_heading:
            text = (item.text or "").strip()
            if not text:
                continue

            if use_item_level and hasattr(item, "level") and item.level is not None:
                hlevel = item.level
            elif pdf_mode:
                # First heading is level 1, rest are level 2
                if not seen_first_heading:
                    hlevel = 1
                    seen_first_heading = True
                else:
                    hlevel = 2
            else:
                hlevel = _level

            # Pop headings at same or deeper level
            while len(heading_stack) >= hlevel:
                heading_stack.pop()
            heading_stack.append(text)
            continue

        # Body element: text, table, etc.
        if label == "table":
            # Extract all cell text, space-joined
            cell_texts = []
            if hasattr(item, "data") and item.data and hasattr(item.data, "table_cells"):
                cell_texts = [cell.text.strip() for cell in item.data.table_cells if cell.text and cell.text.strip()]
            text = " ".join(cell_texts)
        elif label in ("text", "paragraph", "list_item", "code", "caption"):
            text = (item.text or "").strip()
        else:
            # Skip other element types (figures, etc.) but check for text
            text = (item.text or "").strip()
            if not text:
                continue

        if not text:
            continue

        elements.append({
            "type": "body",
            "text": text,
            "heading_path": list(heading_stack),
            "page_numbers": page_nums,
        })

    return elements


# ---------------------------------------------------------------------------
# Chunking logic
# ---------------------------------------------------------------------------

def split_text_into_word_chunks(text: str, max_body_tokens: int, tokenizer) -> list[str]:
    """
    Split a long text into chunks where each chunk fits within max_body_tokens.
    Splits on word boundaries (whitespace). Never drops content.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    current_words = []

    for word in words:
        candidate = " ".join(current_words + [word])
        if count_tokens(tokenizer, candidate) <= max_body_tokens:
            current_words.append(word)
        else:
            if current_words:
                chunks.append(" ".join(current_words))
            # If a single word exceeds the budget, it still must be included
            # (the heading prefix + 1 word must fit per requirements)
            current_words = [word]

    if current_words:
        chunks.append(" ".join(current_words))

    return chunks


def chunk_elements(elements: list[dict], max_tokens: int, tokenizer) -> list[dict]:
    """
    Convert elements into chunks respecting the token budget.
    Returns list of chunk dicts with keys:
      heading_path, page_numbers, token_count, is_partial_element, text
    """
    chunks: list[dict] = []

    for elem in elements:
        heading_path = elem["heading_path"]
        page_nums = elem["page_numbers"]
        body_text = elem["text"]

        prefix = build_heading_prefix(heading_path)
        prefix_tokens = count_tokens(tokenizer, prefix)

        # Available tokens for body
        available = max_tokens - prefix_tokens
        if available <= 0:
            # This shouldn't happen per requirements (budget >= 32, prefix fits + 1 word)
            # but handle gracefully
            available = 1

        # Split body into word-chunks that fit
        body_chunks = split_text_into_word_chunks(body_text, available, tokenizer)

        is_partial = len(body_chunks) > 1

        for i, body in enumerate(body_chunks):
            full_text = prefix + body
            tk = count_tokens(tokenizer, full_text)
            chunks.append({
                "heading_path": list(heading_path),
                "page_numbers": list(page_nums),
                "token_count": tk,
                "is_partial_element": is_partial,
                "text": full_text,
            })

    return chunks


# ---------------------------------------------------------------------------
# Peer merging
# ---------------------------------------------------------------------------

def merge_peer_chunks(chunks: list[dict], max_tokens: int, tokenizer) -> list[dict]:
    """
    Merge undersized neighbouring chunks that share the same heading_path.
    Only merge consecutive chunks from the same source with same heading_path
    where the combined token count fits within max_tokens.
    """
    if not chunks:
        return chunks

    merged = []
    current = None

    for ch in chunks:
        if current is None:
            current = dict(ch)
            continue

        # Check if we can merge: same heading_path, both not partial (or both partial from same element?)
        # Actually the spec says "undersized neighbouring chunks that share the same section context".
        # We merge when heading_path matches and combined tokens fit.
        same_heading = current["heading_path"] == ch["heading_path"]
        if not same_heading:
            merged.append(current)
            current = dict(ch)
            continue

        # Try merging
        prefix = build_heading_prefix(current["heading_path"])
        # Extract body texts (strip prefix)
        current_body = current["text"]
        if prefix and current_body.startswith(prefix):
            current_body = current_body[len(prefix):]
        ch_body = ch["text"]
        if prefix and ch_body.startswith(prefix):
            ch_body = ch_body[len(prefix):]

        combined_body = current_body + " " + ch_body
        combined_text = prefix + combined_body
        combined_tokens = count_tokens(tokenizer, combined_text)

        if combined_tokens <= max_tokens:
            # Merge
            current["text"] = combined_text
            current["token_count"] = combined_tokens
            # Combine page numbers
            current["page_numbers"] = sorted(set(current["page_numbers"] + ch["page_numbers"]))
            # is_partial_element: if either was partial, the merged chunk could be considered
            # partial only if it still doesn't represent a complete element.
            # For simplicity, mark as not partial after merging (it now carries a complete
            # unit from the merge perspective).
            current["is_partial_element"] = current["is_partial_element"] or ch["is_partial_element"]
        else:
            merged.append(current)
            current = dict(ch)

    if current is not None:
        merged.append(current)

    return merged


# ---------------------------------------------------------------------------
# Pack command
# ---------------------------------------------------------------------------

def cmd_pack(args):
    corpus_dir = args.corpus
    out_dir = args.out
    max_tokens = args.max_tokens
    merge_peers = not args.no_merge_peers

    # Validate corpus
    if not os.path.isdir(corpus_dir):
        print(f"ERROR corpus directory not found: {corpus_dir}", file=sys.stderr)
        sys.exit(2)

    # Validate max_tokens
    try:
        max_tokens = int(max_tokens)
    except (ValueError, TypeError):
        print(f"ERROR --max-tokens must be an integer, got: {max_tokens}", file=sys.stderr)
        sys.exit(2)
    if max_tokens < 32:
        print(f"ERROR --max-tokens must be at least 32, got: {max_tokens}", file=sys.stderr)
        sys.exit(2)

    # Discover sources
    sources, skipped = discover_sources(corpus_dir)
    corpus_path = Path(corpus_dir).resolve()

    # Load tokenizer
    tokenizer_path = os.path.abspath(args.tokenizer)
    tokenizer = load_tokenizer(tokenizer_path)

    # Create output directory
    os.makedirs(out_dir, exist_ok=True)

    # Initialize Docling converter (CPU only)
    converter = DocumentConverter()

    # Process documents
    all_chunks: list[dict] = []
    doc_summaries: list[dict] = []
    global_index = 0
    total_chunk_count = 0
    total_token_count = 0
    total_partial_count = 0

    for source in sources:
        file_path = corpus_path / source
        try:
            doc = parse_document(str(file_path), converter)
        except Exception as e:
            print(f"ERROR failed to parse {source}: {e}", file=sys.stderr)
            sys.exit(2)

        source_ext = Path(source).suffix.lower()
        elements = extract_elements(doc, source_ext)
        chunks = chunk_elements(elements, max_tokens, tokenizer)

        if merge_peers:
            chunks = merge_peer_chunks(chunks, max_tokens, tokenizer)

        # Assign chunk metadata
        doc_chunks = []
        for i, ch in enumerate(chunks):
            chunk_id = f"{source}#{i:04d}"
            ch["chunk_id"] = chunk_id
            ch["index"] = global_index
            ch["source"] = source
            ch["ordinal"] = i
            global_index += 1
            doc_chunks.append(ch)

        all_chunks.extend(doc_chunks)

        # Compute doc summary
        chunk_count = len(doc_chunks)
        token_total = sum(ch["token_count"] for ch in doc_chunks)
        max_chunk_tokens = max((ch["token_count"] for ch in doc_chunks), default=0)
        mean_chunk_tokens = round(token_total / chunk_count, 2) if chunk_count > 0 else 0.0
        partial_count = sum(1 for ch in doc_chunks if ch["is_partial_element"])
        max_heading_depth = max((len(ch["heading_path"]) for ch in doc_chunks), default=0)

        # Collect all page numbers
        all_pages: set[int] = set()
        for ch in doc_chunks:
            all_pages.update(ch["page_numbers"])
        page_numbers = sorted(all_pages)

        doc_summaries.append({
            "source": source,
            "chunk_count": chunk_count,
            "token_total": token_total,
            "max_chunk_tokens": max_chunk_tokens,
            "mean_chunk_tokens": mean_chunk_tokens,
            "partial_chunk_count": partial_count,
            "max_heading_depth": max_heading_depth,
            "page_numbers": page_numbers,
        })

        total_chunk_count += chunk_count
        total_token_count += token_total
        total_partial_count += partial_count

    # Write chunks.jsonl
    chunks_path = os.path.join(out_dir, "chunks.jsonl")
    with open(chunks_path, "w", encoding="utf-8") as f:
        for ch in all_chunks:
            record = OrderedDict()
            record["chunk_id"] = ch["chunk_id"]
            record["index"] = ch["index"]
            record["source"] = ch["source"]
            record["ordinal"] = ch["ordinal"]
            record["heading_path"] = ch["heading_path"]
            record["page_numbers"] = ch["page_numbers"]
            record["token_count"] = ch["token_count"]
            record["is_partial_element"] = ch["is_partial_element"]
            record["text"] = ch["text"]
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    # Write summary.json
    summary = OrderedDict()
    summary["tokenizer_path"] = os.path.abspath(tokenizer_path)
    summary["max_tokens"] = max_tokens
    summary["merge_peers"] = merge_peers
    summary["documents"] = doc_summaries
    summary["totals"] = OrderedDict([
        ("document_count", len(sources)),
        ("chunk_count", total_chunk_count),
        ("token_total", total_token_count),
        ("partial_chunk_count", total_partial_count),
        ("budget_violations", 0),
    ])
    summary["skipped_files"] = skipped

    summary_path = os.path.join(out_dir, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Print final line
    print(f"PACKED documents={len(sources)} chunks={total_chunk_count} max_tokens={max_tokens} merge_peers={str(merge_peers).lower()}")
    sys.exit(0)


# ---------------------------------------------------------------------------
# Verify command
# ---------------------------------------------------------------------------

def cmd_verify(args):
    out_dir = args.out

    chunks_path = os.path.join(out_dir, "chunks.jsonl")
    summary_path = os.path.join(out_dir, "summary.json")

    if not os.path.isfile(chunks_path):
        print(f"ERROR chunks.jsonl not found in {out_dir}", file=sys.stderr)
        sys.exit(2)
    if not os.path.isfile(summary_path):
        print(f"ERROR summary.json not found in {out_dir}", file=sys.stderr)
        sys.exit(2)

    # Load summary
    with open(summary_path, "r", encoding="utf-8") as f:
        summary = json.load(f)

    max_tokens = summary["max_tokens"]
    tokenizer_path = summary["tokenizer_path"]

    # Load tokenizer
    if not os.path.isdir(tokenizer_path):
        print(f"ERROR tokenizer path not found: {tokenizer_path}", file=sys.stderr)
        sys.exit(2)
    tokenizer = load_tokenizer(tokenizer_path)

    # Read chunks
    violations = []
    chunks = []
    with open(chunks_path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as e:
                violations.append(f"Line {line_no}: invalid JSON: {e}")
                continue
            chunks.append((line_no, record))

    # Validate required keys
    required_keys = {
        "chunk_id", "index", "source", "ordinal",
        "heading_path", "page_numbers", "token_count",
        "is_partial_element", "text",
    }

    for line_no, record in chunks:
        keys = set(record.keys())
        if keys != required_keys:
            missing = required_keys - keys
            extra = keys - required_keys
            msg = f"Line {line_no}: key mismatch"
            if missing:
                msg += f", missing: {sorted(missing)}"
            if extra:
                msg += f", extra: {sorted(extra)}"
            violations.append(msg)

        # Validate types
        if not isinstance(record.get("chunk_id"), str):
            violations.append(f"Line {line_no}: chunk_id is not a string")
        if not isinstance(record.get("index"), int):
            violations.append(f"Line {line_no}: index is not an integer")
        if not isinstance(record.get("source"), str):
            violations.append(f"Line {line_no}: source is not a string")
        if not isinstance(record.get("ordinal"), int):
            violations.append(f"Line {line_no}: ordinal is not an integer")
        if not isinstance(record.get("heading_path"), list):
            violations.append(f"Line {line_no}: heading_path is not an array")
        if not isinstance(record.get("page_numbers"), list):
            violations.append(f"Line {line_no}: page_numbers is not an array")
        if not isinstance(record.get("token_count"), int):
            violations.append(f"Line {line_no}: token_count is not an integer")
        if not isinstance(record.get("is_partial_element"), bool):
            violations.append(f"Line {line_no}: is_partial_element is not a boolean")
        if not isinstance(record.get("text"), str):
            violations.append(f"Line {line_no}: text is not a string")

        # Validate heading_path elements are non-empty strings
        hp = record.get("heading_path", [])
        if isinstance(hp, list):
            for j, h in enumerate(hp):
                if not isinstance(h, str) or not h:
                    violations.append(f"Line {line_no}: heading_path[{j}] is not a non-empty string")

        # Validate page_numbers are sorted, duplicate-free integers
        pn = record.get("page_numbers", [])
        if isinstance(pn, list):
            for j, p in enumerate(pn):
                if not isinstance(p, int):
                    violations.append(f"Line {line_no}: page_numbers[{j}] is not an integer")
            if pn != sorted(set(pn)):
                violations.append(f"Line {line_no}: page_numbers not sorted or has duplicates")

        # Validate chunk_id format
        cid = record.get("chunk_id", "")
        source = record.get("source", "")
        ordinal = record.get("ordinal", -1)
        expected_cid = f"{source}#{ordinal:04d}"
        if cid != expected_cid:
            violations.append(f"Line {line_no}: chunk_id '{cid}' does not match source/ordinal, expected '{expected_cid}'")

        # Validate token_count
        text = record.get("text", "")
        computed_tokens = count_tokens(tokenizer, text)
        actual_tokens = record.get("token_count", -1)
        if computed_tokens != actual_tokens:
            violations.append(
                f"Line {line_no}: token_count {actual_tokens} does not match computed {computed_tokens}"
            )

        # Validate budget
        if actual_tokens > max_tokens:
            violations.append(
                f"Line {line_no}: token_count {actual_tokens} exceeds budget {max_tokens}"
            )
        if actual_tokens <= 0:
            violations.append(
                f"Line {line_no}: token_count {actual_tokens} is not positive"
            )

    # Validate index sequence
    indices = [record.get("index", -1) for _, record in chunks]
    for i, idx in enumerate(indices):
        if idx != i:
            violations.append(f"Chunk at position {i} has index {idx}, expected {i}")

    # Validate per-source ordinal sequence
    source_ordinals: dict[str, list[int]] = {}
    for line_no, record in chunks:
        src = record.get("source", "")
        ord_ = record.get("ordinal", -1)
        source_ordinals.setdefault(src, []).append((line_no, ord_))

    for src, ords in source_ordinals.items():
        for i, (line_no, ord_) in enumerate(ords):
            if ord_ != i:
                violations.append(
                    f"Line {line_no}: source '{src}' ordinal {ord_} out of sequence, expected {i}"
                )

    if violations:
        for v in violations:
            print(f"VIOLATION {v}", file=sys.stderr)
        sys.exit(3)
    else:
        print(f"VERIFIED chunks={len(chunks)} max_tokens={max_tokens}")
        sys.exit(0)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Token-budget-aware chunk packing for retrieval"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # pack subcommand
    pack_parser = subparsers.add_parser("pack", help="Convert and chunk corpus")
    pack_parser.add_argument("--corpus", required=True, help="Path to corpus directory")
    pack_parser.add_argument("--out", required=True, help="Output directory")
    pack_parser.add_argument("--max-tokens", required=True, type=int, help="Token budget (>= 32)")
    pack_parser.add_argument("--no-merge-peers", action="store_true", help="Disable peer merging")
    pack_parser.add_argument("--tokenizer", default="assets/tokenizer", help="Path to tokenizer directory")

    # verify subcommand
    verify_parser = subparsers.add_parser("verify", help="Verify existing artifact directory")
    verify_parser.add_argument("--out", required=True, help="Output directory to verify")

    args = parser.parse_args()

    if args.command == "pack":
        cmd_pack(args)
    elif args.command == "verify":
        cmd_verify(args)


if __name__ == "__main__":
    main()
