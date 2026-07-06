#!/usr/bin/env python3
"""Classify a single document (PDF) using the LlamaCloud Classifier.

Routes an input file to one of three categories -- invoice, receipt, or
contract -- by uploading it to LlamaCloud and running a FAST classify job.
A single line of JSON is printed to stdout describing the result.

Usage:
    python3 classify.py <path-to-pdf>

The LlamaCloud API key is read from the LLAMA_CLOUD_API_KEY environment
variable.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from llama_cloud import LlamaCloud


# Classification rules, evaluated in order by the LlamaCloud Classifier.
RULES: list[dict[str, str]] = [
    {
        "type": "invoice",
        "description": (
            "Documents that contain an invoice number, invoice date, a bill-to "
            "section, and line items with totals."
        ),
    },
    {
        "type": "receipt",
        "description": (
            "Short purchase receipts, typically from POS systems, with a merchant, "
            "items and a total, often a single page."
        ),
    },
    {
        "type": "contract",
        "description": (
            "Multi-section legal agreement with parties, terms, and signature lines."
        ),
    },
]


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        prog="classify.py",
        description=(
            "Classify a single PDF document as an invoice, receipt, or contract "
            "using the LlamaCloud Classifier."
        ),
    )
    parser.add_argument(
        "file",
        help="Local file path to the document (PDF) to classify.",
    )
    return parser.parse_args()


def classify_document(file_path: Path) -> dict[str, Any]:
    """Upload and classify a single document, returning the result dict.

    Raises RuntimeError on any failure (missing API key, upload error,
    classifier error, or an empty/invalid result).
    """
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise RuntimeError(
            "LLAMA_CLOUD_API_KEY environment variable is not set or is empty."
        )

    # The client picks up LLAMA_CLOUD_API_KEY from the environment REDACTEDmatically,
    # but we pass it explicitly to surface a clear error early if it is missing.
    client = LlamaCloud(api_key=api_key)

    # 1. Upload the file with purpose="classify".
    try:
        upload = client.files.create(file=file_path, purpose="classify")
    except Exception as exc:  # noqa: BLE001 - surface any upload failure cleanly
        raise RuntimeError(f"Failed to upload file '{file_path}': {exc}") from exc

    file_id = upload.id
    if not file_id:
        raise RuntimeError("File upload succeeded but no file id was returned.")

    # 2. Run the FAST classify job with the three rules.
    try:
        response = client.classifier.classify(
            file_ids=[file_id],
            rules=RULES,
            mode="FAST",
        )
    except Exception as exc:  # noqa: BLE001 - surface any classifier failure cleanly
        raise RuntimeError(f"Classifier call failed for file '{file_path}': {exc}") from exc

    # 3. Extract the single returned item.
    items = getattr(response, "items", None)
    if not items:
        raise RuntimeError("Classifier returned no result items.")

    item = items[0]
    result = getattr(item, "result", None)
    if result is None:
        raise RuntimeError("Classifier returned an item with no result.")

    classified_type = getattr(result, "type", None)
    confidence = getattr(result, "confidence", None)

    if classified_type is None:
        raise RuntimeError("Classifier did not assign a document type.")

    return {
        "type": classified_type,
        "confidence": confidence,
        "file": str(file_path),
    }


def main() -> int:
    """Entry point: parse args, classify, print JSON, return exit code."""
    args = parse_args()

    file_path = Path(args.file).resolve()
    if not file_path.is_file():
        print(
            json.dumps({"error": f"File not found: {file_path}"}),
            file=sys.stderr,
        )
        return 1

    try:
        result = classify_document(file_path)
    except RuntimeError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - catch-all for unexpected SDK errors
        print(json.dumps({"error": f"Unexpected error: {exc}"}), file=sys.stderr)
        return 1

    # Print a single line of JSON to stdout.
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())