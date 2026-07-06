#!/usr/bin/env python3
import sys
import os
import argparse
import json
from pathlib import Path
from llama_cloud import LlamaCloud
from llama_cloud.types.classifier import ClassifierRuleParam

def main():
    # Parse CLI arguments
    parser = argparse.ArgumentParser(
        description="Classify a document using LlamaCloud Classifier."
    )
    parser.add_argument(
        "file_path",
        help="Path to the document (PDF) to classify"
    )
    args = parser.parse_args()

    # Resolve absolute path of the input file
    local_path = Path(args.file_path).resolve()
    if not local_path.is_file():
        print(f"Error: File not found at {local_path}", file=sys.stderr)
        sys.exit(1)

    # Check for LLAMA_CLOUD_API_KEY environment variable
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    try:
        # Instantiate LlamaCloud client
        client = LlamaCloud(api_key=api_key)

        # Upload the file with purpose="classify"
        with open(local_path, "rb") as f:
            file_response = client.files.create(file=f, purpose="classify")
        
        file_id = file_response.id
        if not file_id:
            print("Error: Upload succeeded but returned an empty file ID.", file=sys.stderr)
            sys.exit(1)

        # Define the three classification rules exactly as specified (in this order)
        rules = [
            ClassifierRuleParam(
                type="invoice",
                description="documents that contain an invoice number, invoice date, bill-to section, and line items with totals."
            ),
            ClassifierRuleParam(
                type="receipt",
                description="short purchase receipts, typically from POS systems, with merchant, items and total, often a single page."
            ),
            ClassifierRuleParam(
                type="contract",
                description="multi-section legal agreement with parties, terms, and signature lines."
            )
        ]

        # Call LlamaCloud Classifier using mode="FAST"
        classify_response = client.classifier.classify(
            file_ids=[file_id],
            rules=rules,
            mode="FAST"
        )

        # Extract classification results
        if not classify_response.items:
            print("Error: Classifier returned empty results list.", file=sys.stderr)
            sys.exit(1)

        result_item = classify_response.items[0]
        if not result_item.result:
            print("Error: Classification result is missing.", file=sys.stderr)
            sys.exit(1)

        classified_type = result_item.result.type
        confidence = result_item.result.confidence

        if classified_type is None:
            print("Error: Classified type is None.", file=sys.stderr)
            sys.exit(1)

        # Print JSON output to stdout
        output = {
            "type": classified_type,
            "confidence": confidence,
            "file": str(local_path)
        }
        print(json.dumps(output))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
