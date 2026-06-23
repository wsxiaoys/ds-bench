#!/usr/bin/env python3
"""
classify.py – Classify a PDF document using the LlamaCloud Classifier.

Usage:
    python3 classify.py <file_path>

Reads LLAMA_CLOUD_API_KEY from the environment (also accepts LLAMA_PARSE_API_KEY).
Prints a single JSON line with keys: file, type, confidence.
Exits 0 on success, non-zero on any error.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud
from llama_cloud.types.classifier import ClassifierRuleParam


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Classify a PDF document as invoice, receipt, or contract."
    )
    parser.add_argument(
        "file",
        help="Path to the local PDF file to classify.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Resolve to an absolute path early so we can echo it in the output.
    file_path = Path(args.file).resolve()

    if not file_path.exists():
        print(f"Error: file not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY") or os.environ.get("LLAMA_PARSE_API_KEY")
    if not api_key:
        print(
            "Error: LLAMA_CLOUD_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Instantiate the client.  It automatically reads LLAMA_CLOUD_API_KEY /
    # LLAMA_PARSE_API_KEY from the environment; we also pass it explicitly.
    client = LlamaCloud(api_key=api_key)

    # ------------------------------------------------------------------ #
    # Step 1: Upload the file to LlamaCloud with purpose="classify".      #
    # ------------------------------------------------------------------ #
    try:
        with file_path.open("rb") as fh:
            upload_response = client.files.create(
                file=fh,
                purpose="classify",
            )
        file_id: str = upload_response.id
    except Exception as exc:
        print(f"Error: file upload failed: {exc}", file=sys.stderr)
        sys.exit(2)

    # ------------------------------------------------------------------ #
    # Step 2: Run the classifier with the three ordered rules.            #
    # The classify() convenience method submits the job, polls until      #
    # completion, and returns a JobGetResultsResponse.                    #
    # ------------------------------------------------------------------ #
    rules: list[ClassifierRuleParam] = [
        ClassifierRuleParam(
            type="invoice",
            description=(
                "documents that contain an invoice number, invoice date, "
                "bill-to section, and line items with totals."
            ),
        ),
        ClassifierRuleParam(
            type="receipt",
            description=(
                "short purchase receipts, typically from POS systems, with "
                "merchant, items and total, often a single page."
            ),
        ),
        ClassifierRuleParam(
            type="contract",
            description=(
                "multi-section legal agreement with parties, terms, and "
                "signature lines."
            ),
        ),
    ]

    try:
        classify_response = client.classifier.classify(
            file_ids=[file_id],
            rules=rules,
            mode="FAST",
        )
    except Exception as exc:
        print(f"Error: classification request failed: {exc}", file=sys.stderr)
        sys.exit(3)

    # ------------------------------------------------------------------ #
    # Step 3: Extract the single result item and emit JSON.               #
    # ------------------------------------------------------------------ #
    items = classify_response.items if classify_response.items else []
    if not items:
        print("Error: classifier returned an empty result.", file=sys.stderr)
        sys.exit(4)

    item = items[0]
    result = item.result

    if result is None:
        print("Error: classifier result is None (job may have failed).", file=sys.stderr)
        sys.exit(5)

    doc_type = result.type
    confidence = result.confidence

    if doc_type is None:
        print("Error: classifier result missing 'type'.", file=sys.stderr)
        sys.exit(6)

    output = {
        "file": str(file_path),
        "type": doc_type,
        "confidence": confidence,
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
