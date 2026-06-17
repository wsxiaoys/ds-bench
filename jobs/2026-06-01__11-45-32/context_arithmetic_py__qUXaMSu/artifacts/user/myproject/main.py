import argparse
import json
import os
import sys
import time
from typing import Any, Dict, Iterable, List, Optional

from alchemyst_ai import AlchemystAI


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Context Arithmetic demo")
    parser.add_argument(
        "--groups",
        nargs="+",
        required=True,
        help="One or more group names to intersect",
    )
    return parser.parse_args()


def get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def build_documents(run_id: str) -> List[Dict[str, Any]]:
    docs = [
        (
            "Document A content for context arithmetic testing.",
            "docA",
            ["eng", "v1"],
        ),
        (
            "Document B content for context arithmetic testing.",
            "docB",
            ["eng", "v2"],
        ),
        (
            "Document C content for context arithmetic testing.",
            "docC",
            ["docs", "v1"],
        ),
    ]
    documents: List[Dict[str, Any]] = []
    for content, prefix, groups in docs:
        file_name = f"{prefix}-{run_id}.md"
        full_content = f"FILE_NAME: {file_name}\n{content}"
        documents.append(
            {
                "content": full_content,
                "metadata": {
                    "file_name": file_name,
                    "group_name": groups,
                },
            }
        )
    return documents


def delete_existing_documents(client: AlchemystAI, documents: Iterable[Dict[str, Any]]) -> None:
    for doc in documents:
        metadata = doc.get("metadata", {})
        file_name = metadata.get("file_name")
        if not file_name:
            continue
        try:
            client.v1.context.delete(metadata={"file_name": file_name})
        except Exception as exc:  # noqa: BLE001
            print(f"Delete skipped for {file_name}: {exc}", file=sys.stderr)


def add_documents(client: AlchemystAI, documents: List[Dict[str, Any]]) -> None:
    delete_existing_documents(client, documents)
    try:
        client.v1.context.add(
            documents=documents,
            context_type="resource",
            source="docs",
            scope="internal",
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to add documents: {exc}", file=sys.stderr)
        raise


def extract_file_name(context: Any) -> Optional[str]:
    if isinstance(context, dict):
        metadata = context.get("metadata", {})
        if isinstance(metadata, dict):
            return metadata.get("file_name") or metadata.get("fileName")
    metadata = getattr(context, "metadata", None)
    if isinstance(metadata, dict):
        return metadata.get("file_name") or metadata.get("fileName")
    content = getattr(context, "content", None)
    if isinstance(content, str) and "FILE_NAME:" in content:
        for line in content.splitlines():
            if line.startswith("FILE_NAME:"):
                return line.replace("FILE_NAME:", "").strip()
    return None


def search_with_retry(
    client: AlchemystAI,
    groups: List[str],
    attempts: int = 3,
    delay_seconds: float = 1.0,
) -> List[Any]:
    last_error: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            result = client.v1.context.search(
                query="context arithmetic test",
                similarity_threshold=0.1,
                scope="internal",
                metadata={"group_name": groups},
            )
            return result.contexts or []
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(delay_seconds)
            else:
                raise
    raise last_error or RuntimeError("Search failed")


def main() -> None:
    args = parse_args()
    api_key = get_env("ALCHEMYST_AI_API_KEY")
    run_id = get_env("ZEALT_RUN_ID")

    client = AlchemystAI(api_key=api_key)

    documents = build_documents(run_id)
    add_documents(client, documents)

    contexts = search_with_retry(client, args.groups)

    seen: Dict[str, Dict[str, str]] = {}
    for context in contexts:
        file_name = extract_file_name(context)
        if file_name and file_name not in seen:
            seen[file_name] = {"file_name": file_name}

    output = list(seen.values())
    print(json.dumps(output))


if __name__ == "__main__":
    main()
