#!/usr/bin/env python3
"""
Document Classification CLI using LlamaCloud Classifier

Classifies PDF documents as invoice, receipt, or contract using LlamaCloud Classifier.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud


def main():
    parser = argparse.ArgumentParser(
        description="Classify documents using LlamaCloud Classifier"
    )
    parser.add_argument(
        "file",
        type=str,
        help="Path to a local PDF file to classify"
    )
    args = parser.parse_args()

    # Resolve absolute path
    file_path = Path(args.file).resolve()

    # Validate file exists
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    if not file_path.is_file():
        print(f"Error: Not a file: {file_path}", file=sys.stderr)
        sys.exit(1)

    # Check for API key
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    try:
        # Initialize LlamaCloud client
        client = LlamaCloud()

        # Upload file with purpose="classify"
        uploaded_file = client.files.create(file=str(file_path), purpose="classify")
        file_id = uploaded_file.id

        # Define classification rules
        rules = [
            {
                "type": "invoice",
                "description": "documents that contain an invoice number, invoice date, bill-to section, and line items with totals"
            },
            {
                "type": "receipt",
                "description": "short purchase receipts, typically from POS systems, with merchant, items and total, often a single page"
            },
            {
                "type": "contract",
                "description": "multi-section legal agreement with parties, terms, and signature lines"
            }
        ]

        # Call classifier with mode="FAST"
        result = client.classifier.classify(
            file_ids=[file_id],
            mode="FAST",
            rules=rules
        )

        # Validate result
        if not result or not result.items or len(result.items) == 0:
            print("Error: No classification results returned", file=sys.stderr)
            sys.exit(1)

        # Get the single result item
        classification = result.items[0]

        # Validate required fields
        if not hasattr(classification, 'result') or not hasattr(classification.result, 'type'):
            print("Error: Invalid classification result format", file=sys.stderr)
            sys.exit(1)

        # Extract classification data
        doc_type = classification.result.type
        confidence = classification.result.confidence

        # Validate type is one of expected values
        valid_types = {"invoice", "receipt", "contract"}
        if doc_type not in valid_types:
            print(f"Error: Unexpected classification type: {doc_type}", file=sys.stderr)
            sys.exit(1)

        # Validate confidence is a number in [0.0, 1.0]
        if not isinstance(confidence, (int, float)) or confidence < 0.0 or confidence > 1.0:
            print(f"Error: Invalid confidence score: {confidence}", file=sys.stderr)
            sys.exit(1)

        # Output JSON result
        output = {
            "file": str(file_path),
            "type": doc_type,
            "confidence": confidence
        }

        print(json.dumps(output))

        # Exit with success
        sys.exit(0)

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()