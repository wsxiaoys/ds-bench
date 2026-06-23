import argparse
import json
import os
import sys
from pathlib import Path
from llama_cloud import LlamaCloud

def main():
    parser = argparse.ArgumentParser(description="Classify a document using LlamaCloud Classifier")
    parser.add_argument("file_path", type=str, help="Path to the document to classify")
    args = parser.parse_args()

    # Resolve absolute path
    file_path = Path(args.file_path).resolve()
    
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    try:
        client = LlamaCloud(api_key=api_key)
        
        # Upload the file
        with open(file_path, "rb") as f:
            uploaded_file = client.files.create(file=(file_path.name, f), purpose="classify")
        
        # Define classification rules
        rules = [
            {
                "type": "invoice",
                "description": "documents that contain an invoice number, invoice date, bill-to section, and line items with totals."
            },
            {
                "type": "receipt",
                "description": "short purchase receipts, typically from POS systems, with merchant, items and total, often a single page."
            },
            {
                "type": "contract",
                "description": "multi-section legal agreement with parties, terms, and signature lines."
            }
        ]
        
        # Call classifier
        response = client.classifier.classify(
            file_ids=[uploaded_file.id],
            rules=rules,
            mode="FAST"
        )
        
        if not response.items:
            print("Error: No classification items returned.", file=sys.stderr)
            sys.exit(1)
            
        result = response.items[0].result
        
        if not result:
            print("Error: No result inside the classification item.", file=sys.stderr)
            sys.exit(1)
            
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
