#!/usr/bin/env python3
"""Command-line utility that splits a concatenated PDF into logical segments
using LlamaCloud's beta ``Split`` API.

Usage:
    python3 run.py --pdf <pdf_path> --config <config_path> --output <output_path>

The LlamaCloud API key must be available via the ``LLAMA_CLOUD_API_KEY``
environment variable (the ``llama-cloud`` SDK will pick it up REDACTEDmatically).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List

from llama_cloud import LlamaCloud


def _build_arg_parser() -> argparse.ArgumentParser:
    """Create and return the CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="run.py",
        description=(
            "Split a concatenated PDF into logical document segments using "
            "LlamaCloud's beta Split API."
        ),
    )
    parser.add_argument(
        "--pdf",
        required=True,
        type=str,
        help="Path to the input PDF file.",
    )
    parser.add_argument(
        "--config",
        required=True,
        type=str,
        help="Path to the JSON file describing the split categories.",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=str,
        help="Path where the segment result JSON will be written.",
    )
    return parser


def _load_categories(config_path: str) -> List[Dict[str, str]]:
    """Load and validate the categories config file.

    The expected schema is::

        {
          "categories": [
            {"name": "<category-name>", "description": "<description>"}
          ]
        }

    Returns the list of category dicts ready to forward to the API.
    """
    with open(config_path, "r", encoding="utf-8") as fh:
        config = json.load(fh)

    if not isinstance(config, dict):
        raise ValueError(
            f"Invalid config file '{config_path}': top-level value must be an object."
        )

    categories = config.get("categories")
    if not isinstance(categories, list) or not categories:
        raise ValueError(
            f"Invalid config file '{config_path}': 'categories' must be a non-empty list."
        )

    normalized: List[Dict[str, str]] = []
    for idx, entry in enumerate(categories):
        if not isinstance(entry, dict):
            raise ValueError(
                f"Invalid config file '{config_path}': category at index {idx} must be an object."
            )
        name = entry.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError(
                f"Invalid config file '{config_path}': category at index {idx} "
                "must include a non-empty 'name' string."
            )
        description = entry.get("description", "")
        if description is None:
            description = ""
        if not isinstance(description, str):
            raise ValueError(
                f"Invalid config file '{config_path}': category at index {idx} "
                "has a non-string 'description'."
            )
        normalized.append({"name": name, "description": description})

    return normalized


def _segments_to_output(segments: List[Any]) -> Dict[str, List[Dict[str, Any]]]:
    """Convert SDK segment objects into the JSON-serializable output schema.

    Each segment is expected to expose ``category`` (str),
    ``pages`` (list of 1-based integers), and ``confidence_category`` (str).
    """
    output_segments: List[Dict[str, Any]] = []
    for seg in segments:
        # The SDK returns pydantic models; use attribute access with a
        # fallback for plain dicts in case the schema ever drifts.
        if isinstance(seg, dict):
            category = seg.get("category")
            pages = seg.get("pages", [])
            confidence = seg.get("confidence_category")
        else:
            category = getattr(seg, "category", None)
            pages = getattr(seg, "pages", []) or []
            confidence = getattr(seg, "confidence_category", None)

        # Ensure page numbers are plain ints and 1-based.
        normalized_pages = [int(p) for p in pages]

        output_segments.append(
            {
                "category": str(category) if category is not None else "",
                "pages": normalized_pages,
                "confidence_category": str(confidence) if confidence is not None else "",
            }
        )

    return {"segments": output_segments}


def _validate_input_files(pdf_path: str, config_path: str) -> None:
    """Validate that the input files exist and are readable."""
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    if not os.path.isfile(config_path):
        raise FileNotFoundError(f"Config file not found: {config_path}")


def _run_split(pdf_path: str, categories: List[Dict[str, str]]) -> List[Any]:
    """Upload the PDF and run the split job, returning the segments list."""
    if not os.environ.get("LLAMA_CLOUD_API_KEY") and not os.environ.get(
        "LLAMA_PARSE_API_KEY"
    ):
        raise EnvironmentError(
            "LLAMA_CLOUD_API_KEY environment variable is not set."
        )

    client = LlamaCloud()

    # 1) Upload the PDF with the 'split' purpose.
    with open(pdf_path, "rb") as pdf_file:
        uploaded = client.files.create(file=pdf_file, purpose="split")

    file_id = uploaded.id

    # 2) Submit the split job and wait for completion.
    completed_job = client.beta.split.split(
        categories=categories,
        document_input={"type": "file_id", "value": file_id},
        verbose=True,
    )

    # 3) Pull the segments off the completed job result.
    if completed_job.status != "completed":
        error_message = getattr(completed_job, "error_message", None)
        raise RuntimeError(
            f"Split job did not complete successfully. "
            f"Status: {completed_job.status}. "
            f"Error: {error_message or 'unknown error'}."
        )

    result = getattr(completed_job, "result", None)
    if result is None:
        raise RuntimeError("Split job completed but no result was returned.")

    segments = getattr(result, "segments", None)
    if segments is None:
        raise RuntimeError("Split job completed but result.segments is missing.")

    if not segments:
        raise RuntimeError("Split job returned no segments.")

    return list(segments)


def main(argv: List[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    try:
        _validate_input_files(args.pdf, args.config)
        categories = _load_categories(args.config)
        segments = _run_split(args.pdf, categories)
        output_payload = _segments_to_output(segments)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except EnvironmentError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 3
    except Exception as exc:  # noqa: BLE001 - surface any SDK/network errors clearly
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    # Make sure the output directory exists.
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(output_payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())