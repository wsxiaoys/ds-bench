#!/usr/bin/env python3
import os
import sys
import json
import argparse
from llama_cloud import LlamaCloud

def main():
    parser = argparse.ArgumentParser(description="Split a concatenated PDF into logical segments using LlamaCloud.")
    parser.add_argument("--pdf", required=True, help="Path to the input PDF file.")
    parser.add_argument("--config", required=True, help="Path to the JSON config file describing the categories.")
    parser.add_argument("--output", required=True, help="Path where the segment result JSON should be written.")
    
    # Parse arguments
    try:
        args = parser.parse_args()
    except SystemExit as e:
        # argparse automatically exits with 2 if arguments are invalid/missing.
        sys.exit(e.code)

    # Validate that required environment variable is present
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # Validate that input files exist
    if not os.path.exists(args.pdf):
        print(f"Error: PDF file not found at '{args.pdf}'", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(args.config):
        print(f"Error: Config file not found at '{args.config}'", file=sys.stderr)
        sys.exit(1)

    # Read categories from config
    try:
        with open(args.config, "r", encoding="utf-8") as f:
            config_data = json.load(f)
    except Exception as e:
        print(f"Error: Failed to parse JSON config file: {e}", file=sys.stderr)
        sys.exit(1)

    if "categories" not in config_data or not isinstance(config_data["categories"], list):
        print("Error: Config JSON must contain a 'categories' list.", file=sys.stderr)
        sys.exit(1)

    categories = config_data["categories"]
    if not categories:
        print("Error: The 'categories' list in the config must not be empty.", file=sys.stderr)
        sys.exit(1)

    for idx, cat in enumerate(categories):
        if "name" not in cat:
            print(f"Error: Category at index {idx} is missing the required 'name' field.", file=sys.stderr)
            sys.exit(1)

    # Initialize LlamaCloud client
    try:
        client = LlamaCloud(api_key=api_key)
    except Exception as e:
        print(f"Error: Failed to initialize LlamaCloud client: {e}", file=sys.stderr)
        sys.exit(1)

    # Upload the PDF file
    print(f"Uploading PDF file '{args.pdf}' to LlamaCloud...")
    try:
        with open(args.pdf, "rb") as f:
            file_response = client.files.create(file=f, purpose="split")
        file_id = file_response.id
        print(f"File uploaded successfully. File ID: {file_id}")
    except Exception as e:
        print(f"Error: Failed to upload PDF file: {e}", file=sys.stderr)
        sys.exit(1)

    # Submit the split job and wait for completion
    print("Submitting split job and waiting for completion...")
    try:
        # Use the synchronous helper split
        split_response = client.beta.split.split(
            categories=categories,
            document_input={"type": "file_id", "value": file_id}
        )
    except Exception as e:
        print(f"Error: Split job failed or was interrupted: {e}", file=sys.stderr)
        sys.exit(1)

    # Process and format the result
    if not split_response.result or not split_response.result.segments:
        print("Error: Split job completed but returned no segments.", file=sys.stderr)
        sys.exit(1)

    output_segments = []
    for segment in split_response.result.segments:
        output_segments.append({
            "category": segment.category,
            "pages": [int(p) for p in segment.pages],
            "confidence_category": segment.confidence_category
        })

    output_data = {
        "segments": output_segments
    }

    # Ensure output directory exists
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Write output to file
    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)
        print(f"Successfully wrote segment results to '{args.output}'")
    except Exception as e:
        print(f"Error: Failed to write output JSON: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
