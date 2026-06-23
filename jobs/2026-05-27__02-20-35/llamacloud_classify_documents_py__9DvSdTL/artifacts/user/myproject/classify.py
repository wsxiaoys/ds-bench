#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud

RULES = [
    {
        "type": "invoice",
        "description": "documents that contain an invoice number, invoice date, bill-to section, and line items with totals.",
    },
    {
        "type": "receipt",
        "description": "short purchase receipts, typically from POS systems, with merchant, items and total, often a single page.",
    },
    {
        "type": "contract",
        "description": "multi-section legal agreement with parties, terms, and signature lines.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify a document with LlamaCloud Classifier")
    parser.add_argument("file", help="Path to the PDF document")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    file_path = Path(args.file).resolve()

    if not file_path.exists():
        print(f"File not found: {file_path}", file=sys.stderr)
        return 1

    if not os.environ.get("LLAMA_CLOUD_API_KEY"):
        print("LLAMA_CLOUD_API_KEY environment variable is not set", file=sys.stderr)
        return 1

    try:
        client = LlamaCloud()
        uploaded = client.files.create(file=str(file_path), purpose="classify")
        response = client.classifier.classify(
            file_ids=[uploaded.id],
            mode="FAST",
            rules=RULES,
        )
    except Exception as exc:
        print(f"Classifier error: {exc}", file=sys.stderr)
        return 1

    items = getattr(response, "items", None)
    if not items:
        print("Classifier returned no results", file=sys.stderr)
        return 1

    item = items[0]
    result = getattr(item, "result", None)
    if result is None:
        print("Classifier response missing result", file=sys.stderr)
        return 1

    output = {
        "file": str(file_path),
        "type": result.type,
        "confidence": result.confidence,
    }
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
