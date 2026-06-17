import argparse
import json
import os
import sys
from typing import List, Dict, Any

try:
    from llama_cloud import LlamaCloud
except ImportError:
    print("Error: llama-cloud SDK not found. Please install it with 'pip install \"llama-cloud>=2.7\"'")
    sys.exit(1)

def load_categories(config_path: str) -> List[Dict[str, str]]:
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
            if "categories" not in config:
                raise ValueError("Config file must contain a 'categories' key.")
            return config["categories"]
    except Exception as e:
        print(f"Error loading config: {e}")
        sys.exit(1)

def run_split(pdf_path: str, categories: List[Dict[str, str]], output_path: str):
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY environment variable is not set.")
        sys.exit(1)

    client = LlamaCloud(token=api_key)

    # 1. Upload the PDF
    print(f"Uploading {pdf_path}...")
    try:
        with open(pdf_path, "rb") as f:
            uploaded_file = client.files.create(file=f, purpose="split")
            file_id = uploaded_file.id
    except Exception as e:
        print(f"Error uploading file: {e}")
        sys.exit(1)

    # 2. Submit split job and wait for completion
    print("Submitting split job and waiting for completion...")
    try:
        # Using the synchronous helper client.beta.split.split as suggested
        split_result = client.beta.split.split(
            document_input={"type": "file_id", "value": file_id},
            categories=categories
        )
    except Exception as e:
        print(f"Error during split job: {e}")
        sys.exit(1)

    # 3. Read segments and persist to JSON
    segments = []
    for segment in split_result.segments:
        segments.append({
            "category": segment.category,
            "pages": segment.pages,
            "confidence_category": segment.confidence_category
        })

    output_data = {"segments": segments}

    try:
        with open(output_path, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"Successfully wrote segments to {output_path}")
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Split a concatenated PDF into logical segments using LlamaCloud.")
    parser.add_argument("--pdf", required=True, help="Path to the input PDF file")
    parser.add_argument("--config", required=True, help="Path to the categories configuration JSON file")
    parser.add_argument("--output", required=True, help="Path to the output JSON file")

    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"Error: PDF file not found at {args.pdf}")
        sys.exit(1)
    
    if not os.path.exists(args.config):
        print(f"Error: Config file not found at {args.config}")
        sys.exit(1)

    categories = load_categories(args.config)
    run_split(args.pdf, categories, args.output)

if __name__ == "__main__":
    main()
