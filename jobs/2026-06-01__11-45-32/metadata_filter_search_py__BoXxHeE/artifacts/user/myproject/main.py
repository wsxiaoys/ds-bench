import argparse
import json
import os
import sys
from typing import Iterable

from alchemyst_ai import AlchemystAI


GROUPS = ["support", "billing", "engineering"]


def _get_env_var(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _seed_documents(client: AlchemystAI, run_id: str) -> None:
    documents = []
    for group in GROUPS:
        for index in range(1, 3):
            file_name = f"{run_id}-{group}-doc-{index}.txt"
            documents.append(
                {
                    "content": (
                        f"{group.title()} handbook section {index}. "
                        f"This document belongs to the {group} team."
                    ),
                    "metadata": {
                        "file_name": file_name,
                        "group_name": [group],
                    },
                }
            )

    # Ensure idempotency by deleting any existing documents with the same file_name.
    for doc in documents:
        try:
            client.v1.context.delete(metadata={"file_name": doc["metadata"]["file_name"]})
        except Exception:
            # Ignore missing documents or any 4xx errors so re-seeding can continue.
            pass

    client.v1.context.add(documents=documents, scope="internal")


def _dedupe_file_names(contexts: Iterable) -> list[str]:
    seen = set()
    results = []
    for context in contexts:
        metadata = getattr(context, "metadata", None) or {}
        file_name = metadata.get("file_name")
        if file_name and file_name not in seen:
            seen.add(file_name)
            results.append(file_name)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter Alchemyst AI documents by group.")
    parser.add_argument("--group", required=True, choices=GROUPS)
    args = parser.parse_args()

    api_key = _get_env_var("ALCHEMYST_AI_API_KEY")
    run_id = _get_env_var("ZEALT_RUN_ID")

    client = AlchemystAI(api_key=api_key)

    _seed_documents(client, run_id)

    result = client.v1.context.search(
        query=f"{args.group} team handbook",
        scope="internal",
        metadata={"group_name": [args.group]},
    )

    contexts = getattr(result, "contexts", None) or []
    file_names = _dedupe_file_names(contexts)

    json.dump(file_names, sys.stdout)


if __name__ == "__main__":
    main()
