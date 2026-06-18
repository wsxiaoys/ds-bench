#!/usr/bin/env python3
"""
CLI utility to split concatenated PDFs into logical segments using LlamaCloud's Split API.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from llama_cloud import LlamaCloud


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Split concatenated PDFs into logical segments using LlamaCloud's Split API."
    )
    parser.add_argument(
        "--pdf",
        required=True,
        help="Path to the input PDF file to split."
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Path to the JSON file containing categories configuration."
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path where the segment result JSON should be written."
    )
    return parser.parse_args()


def validate_arguments(args):
    """Validate the provided arguments."""
    # Check if PDF file exists
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: PDF file does not exist: {args.pdf}", file=sys.stderr)
        sys.exit(1)
    
    if not pdf_path.is_file():
        print(f"Error: PDF path is not a file: {args.pdf}", file=sys.stderr)
        sys.exit(1)
    
    # Check if config file exists
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Error: Config file does not exist: {args.config}", file=sys.stderr)
        sys.exit(1)
    
    if not config_path.is_file():
        print(f"Error: Config path is not a file: {args.config}", file=sys.stderr)
        sys.exit(1)
    
    # Check if output directory exists
    output_path = Path(args.output)
    output_dir = output_path.parent
    if output_dir != Path('.') and not output_dir.exists():
        print(f"Error: Output directory does not exist: {output_dir}", file=sys.stderr)
        sys.exit(1)


def load_categories_config(config_path):
    """Load and validate the categories configuration file."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in config file: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: Failed to read config file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Validate config structure
    if "categories" not in config:
        print(f"Error: Config file must contain a 'categories' key", file=sys.stderr)
        sys.exit(1)
    
    if not isinstance(config["categories"], list):
        print(f"Error: 'categories' must be an array", file=sys.stderr)
        sys.exit(1)
    
    if len(config["categories"]) == 0:
        print(f"Error: 'categories' array must not be empty", file=sys.stderr)
        sys.exit(1)
    
    # Validate each category entry
    for i, category in enumerate(config["categories"]):
        if not isinstance(category, dict):
            print(f"Error: Category at index {i} must be an object", file=sys.stderr)
            sys.exit(1)
        
        if "name" not in category:
            print(f"Error: Category at index {i} missing 'name' field", file=sys.stderr)
            sys.exit(1)
        
        if "description" not in category:
            print(f"Error: Category at index {i} missing 'description' field", file=sys.stderr)
            sys.exit(1)
    
    return config["categories"]


def get_api_key():
    """Get the LlamaCloud API key from environment variable."""
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set", file=sys.stderr)
        sys.exit(1)
    return api_key


def upload_pdf(client, pdf_path):
    """Upload the PDF file to LlamaCloud."""
    print(f"Uploading PDF: {pdf_path}")
    try:
        with open(pdf_path, 'rb') as f:
            file = client.files.create(
                file=f,
                purpose="split"
            )
        print(f"Uploaded successfully. File ID: {file.id}")
        return file.id
    except Exception as e:
        print(f"Error: Failed to upload PDF: {e}", file=sys.stderr)
        sys.exit(1)


def split_pdf(client, file_id, categories):
    """Submit a split job and wait for completion."""
    print("Submitting split job...")
    try:
        result = client.beta.split.split(
            document_input={"type": "file_id", "value": file_id},
            categories=categories
        )
        print("Split job completed successfully.")
        return result
    except Exception as e:
        print(f"Error: Split job failed: {e}", file=sys.stderr)
        sys.exit(1)


def extract_segments(split_result):
    """Extract segments from the split result."""
    segments = []
    
    for segment in split_result.segments:
        segment_data = {
            "category": segment.category,
            "pages": list(segment.pages),  # Convert to list to ensure JSON serializability
            "confidence_category": segment.confidence_category
        }
        segments.append(segment_data)
    
    return segments


def write_output(output_path, segments):
    """Write the segments to the output JSON file."""
    output_data = {
        "segments": segments
    }
    
    try:
        with open(output_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"Output written to: {output_path}")
    except Exception as e:
        print(f"Error: Failed to write output file: {e}", file=sys.stderr)
        sys.exit(1)


def validate_segments(segments, total_pages):
    """Validate that segments cover all pages without duplicates."""
    all_pages = []
    for segment in segments:
        all_pages.extend(segment["pages"])
    
    # Check for duplicates
    if len(all_pages) != len(set(all_pages)):
        print("Error: Segments contain duplicate page numbers", file=sys.stderr)
        sys.exit(1)
    
    # Check that all pages are covered
    expected_pages = set(range(1, total_pages + 1))
    actual_pages = set(all_pages)
    
    if expected_pages != actual_pages:
        missing = expected_pages - actual_pages
        extra = actual_pages - expected_pages
        error_msg = []
        if missing:
            error_msg.append(f"missing pages: {sorted(missing)}")
        if extra:
            error_msg.append(f"extra pages: {sorted(extra)}")
        print(f"Error: Segments do not cover all pages: {', '.join(error_msg)}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main entry point."""
    args = parse_arguments()
    validate_arguments(args)
    
    # Load categories configuration
    categories = load_categories_config(args.config)
    print(f"Loaded {len(categories)} categories")
    
    # Get API key
    api_key = get_api_key()
    
    # Initialize LlamaCloud client
    client = LlamaCloud(api_key=api_key)
    
    # Upload PDF
    file_id = upload_pdf(client, args.pdf)
    
    # Split PDF
    split_result = split_pdf(client, file_id, categories)
    
    # Extract segments
    segments = extract_segments(split_result)
    
    # Validate segments (get total pages from the result)
    total_pages = sum(len(segment["pages"]) for segment in segments)
    validate_segments(segments, total_pages)
    
    print(f"Extracted {len(segments)} segments covering {total_pages} pages")
    
    # Write output
    write_output(args.output, segments)
    
    print("Done!")
    sys.exit(0)


if __name__ == "__main__":
    main()