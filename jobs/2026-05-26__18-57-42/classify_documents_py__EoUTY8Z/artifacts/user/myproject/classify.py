import argparse
import json
import os
import sys
from pathlib import Path
from llama_cloud import LlamaCloud

def main():
    parser = argparse.ArgumentParser(description="Classify a document using LlamaCloud Classifier.")
    parser.add_argument("file_path", help="Path to the local PDF document.")
    args = parser.parse_args()

    file_path = Path(args.file_path).resolve()
    if not file_path.exists():
        print(f"Error: File {file_path} does not exist.", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    try:
        client = LlamaCloud(token=api_key)

        # 1. Upload the file
        with open(file_path, "rb") as f:
            uploaded_file = client.files.create(file=f, purpose="classify")
        
        file_id = uploaded_file.id

        # 2. Run classification
        # Define the rules as specified
        rules = [
            {"type": "invoice", "rule": "documents that contain an invoice number, invoice date, bill-to section, and line items with totals."},
            {"type": "receipt", "rule": "short purchase receipts, typically from POS systems, with merchant, items and total, often a single page."},
            {"type": "contract", "rule": "multi-section legal agreement with parties, terms, and signature lines."}
        ]

        response = client.classifier.classify(
            file_ids=[file_id],
            mode="FAST",
            rules=rules
        )

        if not response.items:
            print("Error: No classification results returned.", file=sys.stderr)
            sys.exit(1)

        # 3. Process result
        item = response.items[0]
        result = item.result

        output = {
            "file": str(file_path),
            "type": result.type,
            "confidence": result.confidence
        }

        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
