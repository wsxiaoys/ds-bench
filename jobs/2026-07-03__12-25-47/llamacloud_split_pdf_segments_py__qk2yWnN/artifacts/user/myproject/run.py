#!/usr/bin/env python3
"""Split a concatenated PDF into logical segments using LlamaCloud (beta)."""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List

from llama_cloud import LlamaCloud


def parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Split a concatenated PDF into logical segments with LlamaCloud's "
            "beta Split API."
        ),
    )
    parser.add_argument(
        "--pdf",
        required=True,
        help="Path to the input PDF file.",
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Path to the categories configuration JSON file.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to the file where the segment result JSON will be written.",
    )
    return parser.parse_args(argv)


def load_categories(config_path: str) -> List[Dict[str, str]]:
    """Load and validate the categories configuration file."""
    if not os.path.isfile(config_path):
        raise FileNotFoundError(f"Config file not found: {config_path}")
    with open(config_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict) or "categories" not in data:
        raise ValueError(
            "Config JSON must be an object with a 'categories' key."
        )
    categories = data["categories"]
    if not isinstance(categories, list) or not categories:
        raise ValueError("'categories' must be a non-empty list.")
    cleaned: List[Dict[str, str]] = []
    for idx, entry in enumerate(categories):
        if not isinstance(entry, dict):
            raise ValueError(
                f"Category at index {idx} must be an object with 'name'/"
                "'description'."
            )
        if "name" not in entry or "description" not in entry:
            raise ValueError(
                f"Category at index {idx} must contain 'name' and 'description'."
            )
        name = str(entry["name"]).strip()
        description = str(entry["description"]).strip()
        if not name or not description:
            raise ValueError(
                f"Category at index {idx} has empty name or description."
            )
        cleaned.append({"name": name, "description": description})
    return cleaned


def _segment_to_dict(segment: Any) -> Dict[str, Any]:
    """Normalize a single segment into the expected JSON shape."""
    # Prefer attribute access for pydantic models; fall back to dict-like access.
    def _get(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    category = _get(segment, "category", "")
    confidence = _get(segment, "confidence_category", "")
    pages = _get(segment, "pages", [])
    if category is None:
        category = ""
    if confidence is None:
        confidence = ""
    if pages is None:
        pages = []
    pages_list = [int(p) for p in pages]
    return {
        "category": str(category),
        "pages": pages_list,
        "confidence_category": str(confidence),
    }


def extract_segments(response: Any) -> List[Dict[str, Any]]:
    """Pull the segments list out of a SplitGetResponse-like object."""
    result = getattr(response, "result", None)
    if result is None and isinstance(response, dict):
        result = response.get("result")
    if result is None:
        raise RuntimeError(
            "Split job completed but returned no 'result' payload."
        )
    segments = getattr(result, "segments", None)
    if segments is None and isinstance(result, dict):
        segments = result.get("segments")
    if not segments:
        raise RuntimeError(
            "Split job completed but returned no segments."
        )
    return [_segment_to_dict(s) for s in segments]


def run(args: argparse.Namespace) -> int:
    if not os.path.isfile(args.pdf):
        print(f"Error: PDF file not found: {args.pdf}", file=sys.stderr)
        return 2
    if "LLAMA_CLOUD_API_KEY" not in os.environ:
        print(
            "Error: LLAMA_CLOUD_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        return 2

    categories = load_categories(args.config)

    client = LlamaCloud()

    # 1. Upload the PDF with the 'split' purpose.
    with open(args.pdf, "rb") as fh:
        uploaded = client.files.create(file=fh, purpose="split")
    file_id = uploaded.id
    print(f"Uploaded PDF as file id: {file_id}", file=sys.stderr)

    # 2. Run the split job, blocking until completion.
    response = client.beta.split.split(
        categories=categories,
        document_input={"type": "file_id", "value": file_id},
    )

    # 3. Extract the segment list and persist it.
    segments = extract_segments(response)
    output = {"segments": segments}

    output_path = args.output
    out_dir = os.path.dirname(os.path.abspath(output_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote {len(segments)} segments to {output_path}", file=sys.stderr)
    return 0


def main(argv: List[str] | None = None) -> int:
    try:
        args = parse_args(argv)
    except SystemExit as exc:
        return int(exc.code) if isinstance(exc.code, int) else 2
    try:
        return run(args)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
