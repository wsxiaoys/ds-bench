#!/usr/bin/env python3
"""Split a concatenated PDF into logical segments using LlamaCloud's Split API.

Usage:
    python3 run.py --pdf <pdf_path> --config <config_path> --output <output_path>

The utility uploads the supplied PDF to LlamaCloud, submits a split job using the
categories described in the configuration JSON file, waits for the job to
finish, and writes the resulting segments to the output path as JSON.

Authentication is performed via the ``LLAMA_CLOUD_API_KEY`` environment variable.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from llama_cloud import LlamaCloud


def _parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    """Parse and validate command-line arguments."""
    parser = argparse.ArgumentParser(
        prog="run.py",
        description=(
            "Split a concatenated PDF into logical segments using the "
            "LlamaCloud Split API."
        ),
    )
    parser.add_argument(
        "--pdf",
        required=True,
        help="Path to the input PDF file to be split.",
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Path to a JSON file describing the split categories.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path where the resulting segment JSON should be written.",
    )
    return parser.parse_args(argv)


def _load_categories(config_path: str) -> List[Dict[str, str]]:
    """Load and validate the categories from the configuration JSON file.

    The config file must have the shape::

        {
          "categories": [
            {"name": "<name>", "description": "<description>"}
          ]
        }

    Returns the list of category dicts (each with ``name`` and ``description``).
    """
    try:
        with open(config_path, "r", encoding="utf-8") as fh:
            config = json.load(fh)
    except FileNotFoundError:
        _fail(f"Configuration file not found: {config_path}")
    except json.JSONDecodeError as exc:
        _fail(f"Configuration file is not valid JSON: {exc}")

    if not isinstance(config, dict) or "categories" not in config:
        _fail(
            "Configuration file must be an object with a 'categories' key "
            "containing a list of category definitions."
        )

    categories = config["categories"]
    if not isinstance(categories, list) or not categories:
        _fail("'categories' must be a non-empty list of category definitions.")

    cleaned: List[Dict[str, str]] = []
    for idx, entry in enumerate(categories):
        if not isinstance(entry, dict):
            _fail(f"Category at index {idx} is not an object: {entry!r}")
        name = entry.get("name")
        description = entry.get("description")
        if not isinstance(name, str) or not name.strip():
            _fail(f"Category at index {idx} is missing a non-empty 'name'.")
        if not isinstance(description, str) or not description.strip():
            _fail(f"Category at index {idx} is missing a non-empty 'description'.")
        cleaned.append({"name": name, "description": description})

    return cleaned


def _fail(message: str) -> None:
    """Print an error to stderr and exit with a non-zero status code."""
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def _upload_pdf(client: LlamaCloud, pdf_path: str) -> str:
    """Upload the PDF to LlamaCloud with the ``split`` purpose.

    Returns the uploaded file's id.
    """
    pdf = Path(pdf_path)
    if not pdf.is_file():
        _fail(f"PDF file not found: {pdf_path}")

    with open(pdf, "rb") as fh:
        uploaded = client.files.create(file=(pdf.name, fh), purpose="split")

    if not getattr(uploaded, "id", None):
        _fail("File upload succeeded but no file id was returned by the API.")

    return uploaded.id


def _run_split(
    client: LlamaCloud,
    file_id: str,
    categories: List[Dict[str, str]],
) -> List[Dict[str, Any]]:
    """Submit a split job, wait for completion, and return the segment list."""
    result = client.beta.split.split(
        categories=categories,
        document_input={"type": "file_id", "value": file_id},
    )

    segments = getattr(getattr(result, "result", None), "segments", None)
    if not segments:
        # Surface any error message reported by the job for easier debugging.
        error_message = getattr(result, "error_message", None)
        status = getattr(result, "status", None)
        _fail(
            "Split job completed but returned no segments."
            + (f" (status={status})" if status else "")
            + (f" error_message={error_message!r}" if error_message else "")
        )

    return segments


def _segments_to_json(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert the API segment objects into the required output structure."""
    out_segments: List[Dict[str, Any]] = []
    for segment in segments:
        category = getattr(segment, "category", None)
        confidence_category = getattr(segment, "confidence_category", None)
        pages = list(getattr(segment, "pages", []) or [])

        if not isinstance(category, str) or not category.strip():
            _fail(f"Segment missing a valid 'category': {segment!r}")
        if not isinstance(confidence_category, str):
            _fail(f"Segment missing a valid 'confidence_category': {segment!r}")
        if not all(isinstance(p, int) for p in pages):
            _fail(f"Segment 'pages' must contain integers only: {pages!r}")

        out_segments.append(
            {
                "category": category,
                "pages": pages,
                "confidence_category": confidence_category,
            }
        )

    return {"segments": out_segments}


def _write_output(output_path: str, payload: Dict[str, Any]) -> None:
    """Write the segment payload to the output path as pretty-printed JSON."""
    out = Path(output_path)
    if out.parent and not out.parent.exists():
        out.parent.mkdir(parents=True, exist_ok=True)

    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")


def main(argv: List[str] | None = None) -> int:
    args = _parse_args(argv)

    # Validate local inputs first so the user gets the most relevant error
    # before we require the network/API key.
    categories = _load_categories(args.config)

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        _fail(
            "The LLAMA_CLOUD_API_KEY environment variable is not set. "
            "Set it to your LlamaCloud API key before running this utility."
        )

    client = LlamaCloud(api_key=api_key)

    file_id = _upload_pdf(client, args.pdf)
    print(f"Uploaded PDF '{args.pdf}' as file_id={file_id}", file=sys.stderr)

    segments = _run_split(client, file_id, categories)
    print(
        f"Split job complete: {len(segments)} segment(s) returned.",
        file=sys.stderr,
    )

    payload = _segments_to_json(segments)
    _write_output(args.output, payload)
    print(f"Wrote segments to '{args.output}'", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())