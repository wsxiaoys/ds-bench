#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from llama_cloud import LlamaCloud


def load_categories(config_path: Path) -> List[Dict[str, str]]:
    try:
        with config_path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Failed to read categories config: {exc}") from exc

    categories = payload.get("categories")
    if not isinstance(categories, list) or not categories:
        raise ValueError("Config must contain a non-empty 'categories' array.")

    normalized: List[Dict[str, str]] = []
    for entry in categories:
        if not isinstance(entry, dict):
            raise ValueError("Each category must be an object with name/description.")
        name = entry.get("name")
        description = entry.get("description")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Each category requires a non-empty 'name'.")
        if not isinstance(description, str) or not description.strip():
            raise ValueError("Each category requires a non-empty 'description'.")
        normalized.append({"name": name, "description": description})

    return normalized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Split a concatenated PDF into logical segments using LlamaCloud."
    )
    parser.add_argument("--pdf", required=True, help="Path to the input PDF file.")
    parser.add_argument(
        "--config", required=True, help="Path to the JSON categories configuration file."
    )
    parser.add_argument(
        "--output", required=True, help="Path to write the output JSON segments."
    )
    return parser.parse_args()


def ensure_file(path: Path, label: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"{label} not found: {path}")
    if not path.is_file():
        raise ValueError(f"{label} is not a file: {path}")


def build_segments_payload(segments: List[Any]) -> Dict[str, Any]:
    output_segments: List[Dict[str, Any]] = []
    for segment in segments:
        output_segments.append(
            {
                "category": segment.category,
                "pages": [int(page) for page in segment.pages],
                "confidence_category": segment.confidence_category,
            }
        )
    if not output_segments:
        raise ValueError("Split API returned no segments.")
    return {"segments": output_segments}


def main() -> int:
    args = parse_args()

    pdf_path = Path(args.pdf)
    config_path = Path(args.config)
    output_path = Path(args.output)

    try:
        ensure_file(pdf_path, "PDF file")
        ensure_file(config_path, "Config file")
        categories = load_categories(config_path)
    except (ValueError, FileNotFoundError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set.", file=sys.stderr)
        return 2

    client = LlamaCloud(api_key=api_key)

    try:
        with pdf_path.open("rb") as pdf_file:
            uploaded = client.files.create(file=pdf_file, purpose="split")

        job = client.beta.split.split(
            document_input={"type": "file_id", "value": uploaded.id},
            categories=categories,
        )

        segments_payload = build_segments_payload(job.segments)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: failed to run split job: {exc}", file=sys.stderr)
        return 1

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as file:
            json.dump(segments_payload, file, indent=2, sort_keys=False)
            file.write("\n")
    except OSError as exc:
        print(f"Error: failed to write output file: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
