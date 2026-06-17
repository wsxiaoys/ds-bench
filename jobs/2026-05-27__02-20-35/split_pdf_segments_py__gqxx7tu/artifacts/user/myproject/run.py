#!/usr/bin/env python3
"""
run.py – Split a concatenated PDF into logical segments via LlamaCloud.

Usage:
    python3 run.py --pdf <pdf_path> --config <config_path> --output <output_path>

Environment variables:
    LLAMA_CLOUD_API_KEY  LlamaCloud API key (required)
"""

import argparse
import json
import os
import sys

from llama_cloud import LlamaCloud


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run.py",
        description="Split a concatenated PDF into logical segments using LlamaCloud.",
    )
    parser.add_argument(
        "--pdf",
        required=True,
        metavar="PDF_PATH",
        help="Path to the input PDF file.",
    )
    parser.add_argument(
        "--config",
        required=True,
        metavar="CONFIG_PATH",
        help="Path to a JSON file describing the split categories.",
    )
    parser.add_argument(
        "--output",
        required=True,
        metavar="OUTPUT_PATH",
        help="Path where the segment result JSON will be written.",
    )
    return parser


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def load_and_validate_config(config_path: str) -> list[dict]:
    """Parse the categories config file and return the categories list."""
    if not os.path.isfile(config_path):
        print(f"error: config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as fh:
        try:
            config = json.load(fh)
        except json.JSONDecodeError as exc:
            print(f"error: config file is not valid JSON: {exc}", file=sys.stderr)
            sys.exit(1)

    if "categories" not in config or not isinstance(config["categories"], list):
        print(
            "error: config file must contain a top-level 'categories' array.",
            file=sys.stderr,
        )
        sys.exit(1)

    categories = config["categories"]
    if not categories:
        print("error: 'categories' array must not be empty.", file=sys.stderr)
        sys.exit(1)

    for i, entry in enumerate(categories):
        if not isinstance(entry, dict) or "name" not in entry or "description" not in entry:
            print(
                f"error: categories[{i}] must have 'name' and 'description' fields.",
                file=sys.stderr,
            )
            sys.exit(1)

    return categories


def validate_pdf(pdf_path: str) -> None:
    if not os.path.isfile(pdf_path):
        print(f"error: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    if not pdf_path.lower().endswith(".pdf"):
        print(f"error: file does not appear to be a PDF: {pdf_path}", file=sys.stderr)
        sys.exit(1)


def get_api_key() -> str:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "").strip()
    if not api_key:
        print(
            "error: LLAMA_CLOUD_API_KEY environment variable is not set or empty.",
            file=sys.stderr,
        )
        sys.exit(1)
    return api_key


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def upload_pdf(client: LlamaCloud, pdf_path: str) -> str:
    """Upload the PDF for splitting and return the resulting file_id."""
    print(f"Uploading '{pdf_path}' …", flush=True)
    with open(pdf_path, "rb") as fh:
        upload_response = client.files.create(
            file=(os.path.basename(pdf_path), fh, "application/pdf"),
            purpose="split",
        )
    file_id = upload_response.id
    print(f"Upload complete. File ID: {file_id}", flush=True)
    return file_id


def run_split_job(client: LlamaCloud, file_id: str, categories: list[dict]) -> list[dict]:
    """Submit the split job, wait for completion, and return the segments."""
    print("Submitting split job …", flush=True)

    document_input = {"type": "file_id", "value": file_id}

    result = client.beta.split.split(
        document_input=document_input,
        categories=categories,
    )

    segments = result.result.segments
    print(f"Split job complete. Received {len(segments)} segment(s).", flush=True)
    return segments


def serialise_segments(segments) -> dict:
    """Convert the SDK segment objects into the canonical output dict."""
    output_segments = []
    for seg in segments:
        output_segments.append(
            {
                "category": seg.category,
                "pages": [int(p) for p in seg.pages],
                "confidence_category": seg.confidence_category,
            }
        )
    return {"segments": output_segments}


def write_output(output_path: str, payload: dict) -> None:
    """Write the result JSON to *output_path*, creating parent directories if needed."""
    parent = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(parent, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    print(f"Results written to '{output_path}'.", flush=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    # --- Validate inputs early so we fail fast before hitting the network ---
    api_key = get_api_key()
    validate_pdf(args.pdf)
    categories = load_and_validate_config(args.config)

    # --- Build the LlamaCloud client ---
    client = LlamaCloud(api_key=api_key)

    # --- Upload the PDF ---
    file_id = upload_pdf(client, args.pdf)

    # --- Run the split job ---
    segments = run_split_job(client, file_id, categories)

    # --- Serialise and persist results ---
    payload = serialise_segments(segments)
    write_output(args.output, payload)

    print("Done.")
    sys.exit(0)


if __name__ == "__main__":
    main()
