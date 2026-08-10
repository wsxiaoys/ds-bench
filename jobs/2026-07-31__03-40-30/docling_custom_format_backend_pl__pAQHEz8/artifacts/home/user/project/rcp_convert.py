#!/usr/bin/env python3
"""Unified batch CLI converting a mixed directory of RCP/1.0 and Markdown
documents to Markdown, JSON, and chunk exports using Docling.

Usage (run from /home/user/project):

    python rcp_convert.py --input-dir <INPUT_DIR> --output-dir <OUTPUT_DIR>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

# Ensure the project directory (containing rcp_plugin.py) is importable
# regardless of the caller's working directory.
_PROJECT_DIR = Path(__file__).resolve().parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from docling_core.types.doc import DocItemLabel  # noqa: E402

from docling.chunking import HierarchicalChunker  # noqa: E402
from rcp_plugin import build_converter  # noqa: E402

SCHEMA_VERSION = 1


def _sha256_of_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(65536), b""):
            hasher.update(block)
    return hasher.hexdigest()


def _format_of(name: str) -> str:
    return "rcp" if name.endswith(".rcp") else "md"


def _collect_input_files(input_dir: Path) -> list:
    files = [
        p
        for p in input_dir.iterdir()
        if p.is_file() and (p.name.endswith(".rcp") or p.name.endswith(".md"))
    ]
    return sorted(files, key=lambda p: p.name)


def _count_doc_stats(doc) -> dict:
    num_headings = sum(
        1 for t in doc.texts if t.label == DocItemLabel.SECTION_HEADER
    )
    num_list_items = sum(1 for t in doc.texts if t.label == DocItemLabel.LIST_ITEM)
    return {
        "num_headings": num_headings,
        "num_list_items": num_list_items,
        "num_tables": len(doc.tables),
        "num_pictures": len(doc.pictures),
    }


def run(input_dir: Path, output_dir: Path) -> int:
    if not input_dir.is_dir():
        return 2

    markdown_dir = output_dir / "markdown"
    json_dir = output_dir / "json"
    output_dir.mkdir(parents=True, exist_ok=True)
    markdown_dir.mkdir(parents=True, exist_ok=True)
    json_dir.mkdir(parents=True, exist_ok=True)

    converter = build_converter()
    chunker = HierarchicalChunker()

    input_files = _collect_input_files(input_dir)

    documents: list = []
    chunk_lines: list = []
    succeeded = 0
    failed = 0

    for path in input_files:
        file_name = path.name
        stem = path.stem
        sha256 = _sha256_of_file(path)
        fmt = _format_of(file_name)

        stats = {
            "num_headings": 0,
            "num_list_items": 0,
            "num_tables": 0,
            "num_pictures": 0,
        }
        num_chunks = 0
        status = "failure"

        try:
            result = converter.convert(path, raises_on_error=False)
        except Exception:
            result = None

        if result is not None and str(result.status) == "ConversionStatus.SUCCESS":
            doc = result.document
            status = "success"
            succeeded += 1

            (markdown_dir / f"{stem}.md").write_text(
                doc.export_to_markdown(), encoding="utf-8"
            )
            doc.save_as_json(json_dir / f"{stem}.json")

            stats = _count_doc_stats(doc)

            for chunk_index, chunk in enumerate(chunker.chunk(doc)):
                headings = list(getattr(chunk.meta, "headings", None) or [])
                text = chunk.text
                chunk_lines.append(
                    json.dumps(
                        {
                            "file": file_name,
                            "chunk_index": chunk_index,
                            "headings": headings,
                            "text": text,
                            "num_chars": len(text),
                        }
                    )
                )
                num_chunks += 1
        else:
            failed += 1

        documents.append(
            {
                "file": file_name,
                "format": fmt,
                "status": status,
                "num_headings": stats["num_headings"],
                "num_list_items": stats["num_list_items"],
                "num_tables": stats["num_tables"],
                "num_pictures": stats["num_pictures"],
                "num_chunks": num_chunks,
                "sha256": sha256,
            }
        )

    documents.sort(key=lambda d: d["file"])

    with (output_dir / "chunks.jsonl").open("w", encoding="utf-8") as fh:
        for line in chunk_lines:
            fh.write(line)
            fh.write("\n")

    total = len(input_files)
    summary: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "counts": {
            "total": total,
            "succeeded": succeeded,
            "failed": failed,
        },
        "documents": documents,
    }
    with (output_dir / "summary.json").open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)
        fh.write("\n")

    print(f"converted={succeeded} failed={failed} total={total}")

    return 0 if failed == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    try:
        return run(Path(args.input_dir), Path(args.output_dir))
    except SystemExit:
        raise
    except BaseException:
        # A Python traceback must never reach stderr.
        return 1


if __name__ == "__main__":
    sys.exit(main())
