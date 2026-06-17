import argparse
import json
import os
import sys

from llama_cloud import LlamaCloud

def main():
    parser = argparse.ArgumentParser(description="Split a PDF into logical segments using LlamaCloud.")
    parser.add_argument("--pdf", required=True, help="Path to the input PDF file.")
    parser.add_argument("--config", required=True, help="Path to the JSON configuration file.")
    parser.add_argument("--output", required=True, help="Path to the output JSON file.")
    
    args = parser.parse_args()

    # Check for API key
    if "LLAMA_CLOUD_API_KEY" not in os.environ:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is missing.", file=sys.stderr)
        sys.exit(1)

    # Read config
    try:
        with open(args.config, "r", encoding="utf-8") as f:
            config = json.load(f)
    except Exception as e:
        print(f"Error reading config file: {e}", file=sys.stderr)
        sys.exit(1)
        
    categories = config.get("categories", [])
    if not categories:
        print("Error: No categories found in the config file.", file=sys.stderr)
        sys.exit(1)

    # Initialize client
    client = LlamaCloud()

    # Upload PDF
    try:
        with open(args.pdf, "rb") as f:
            upload_res = client.files.create(file=(os.path.basename(args.pdf), f), purpose="split")
        file_id = upload_res.id
    except Exception as e:
        print(f"Error uploading file: {e}", file=sys.stderr)
        sys.exit(1)

    # Submit split job and wait for completion
    try:
        split_res = client.beta.split.split(
            document_input={"type": "file_id", "value": file_id},
            categories=categories
        )
    except Exception as e:
        print(f"Error during split operation: {e}", file=sys.stderr)
        sys.exit(1)

    if not split_res.result or not split_res.result.segments:
        print("Error: Split operation returned no segments.", file=sys.stderr)
        sys.exit(1)

    # Format result
    segments = []
    for seg in split_res.result.segments:
        segments.append({
            "category": seg.category,
            "pages": seg.pages,
            "confidence_category": seg.confidence_category
        })

    # Write output
    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump({"segments": segments}, f, indent=2)
    except Exception as e:
        print(f"Error writing output file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
