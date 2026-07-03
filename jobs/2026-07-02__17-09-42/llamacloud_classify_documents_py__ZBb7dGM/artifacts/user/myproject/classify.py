#!/usr/bin/env python3
"""Classify a single PDF document using the LlamaCloud Classifier.

Usage:
    python3 classify.py <path-to-pdf>

Reads the API key from the LLAMA_CLOUD_API_KEY environment variable and prints
a single JSON line to stdout containing the classified ``type``, the
``confidence`` score reported by the classifier, and the resolved absolute
``file`` path. Exits with status 0 on success and a non-zero status on any
error (failed upload, classifier error, empty result, etc.).
"""

import argparse
import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud


# Classification rules - order matters and must be preserved exactly.
RULES = [
    {
        "type": "invoice",
        "description": (
            "documents that contain an invoice number, invoice date, bill-to "
            "section, and line items with totals"
        ),
    },
    {
        "type": "receipt",
        "description": (
            "short purchase receipts, typically from POS systems, with "
            "merchant, items and total, often a single page"
        ),
    },
    {
        "type": "contract",
        "description": (
            "multi-section legal agreement with parties, terms, and signature "
            "lines"
        ),
    },
]


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Classify a PDF document using the LlamaCloud Classifier.",
    )
    parser.add_argument(
        "file",
        help="Path to a local PDF document to classify.",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    file_path = Path(args.file).resolve()
    if not file_path.is_file():
        print(
            f"Error: file not found: {args.file}",
            file=sys.stderr,
        )
        return 2

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print(
            "Error: LLAMA_CLOUD_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        return 3

    client = LlamaCloud(api_key=api_key)

    # Upload the file for classification.
    try:
        with open(file_path, "rb") as fh:
            uploaded = client.files.create(file=fh, purpose="classify")
    except Exception as exc:  # pragma: no cover - network/SDK errors
        print(f"Error: failed to upload file: {exc}", file=sys.stderr)
        return 4

    file_id = getattr(uploaded, "id", None)
    if not file_id:
        print("Error: upload succeeded but no file id was returned.",
              file=sys.stderr)
        return 5

    # Run the classifier in FAST mode with the three rules.
    try:
        response = client.classifier.classify(
            file_ids=[file_id],
            rules=RULES,
            mode="FAST",
        )
    except Exception as exc:  # pragma: no cover - network/SDK errors
        print(f"Error: classifier request failed: {exc}", file=sys.stderr)
        return 6

    items = getattr(response, "items", None) or []
    if not items:
        print("Error: classifier returned no items.", file=sys.stderr)
        return 7

    item = items[0]
    result = getattr(item, "result", None)
    if result is None:
        print("Error: classifier item has no result.", file=sys.stderr)
        return 8

    classified_type = getattr(result, "type", None)
    confidence = getattr(result, "confidence", None)

    if classified_type is None:
        print("Error: classifier result is missing a type.",
              file=sys.stderr)
        return 9

    output = {
        "type": classified_type,
        "confidence": confidence,
        "file": str(file_path),
    }
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    sys.exit(main())