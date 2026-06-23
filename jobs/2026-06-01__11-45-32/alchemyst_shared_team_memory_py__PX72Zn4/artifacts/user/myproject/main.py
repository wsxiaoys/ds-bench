import argparse
import os
import sys
import time
from typing import Iterable, List

from alchemyst_ai import AlchemystAI

ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def build_session_ids(run_id: str) -> dict:
    return {
        "session_id": f"session-{run_id}",
        "alice_id": f"alice-{run_id}",
        "bob_id": f"bob-{run_id}",
    }


def search_session(
    client: AlchemystAI,
    *,
    session_id: str,
    query: str,
) -> List[str]:
    response = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        similarity_threshold=0.9,
        query=query,
        scope="internal",
        body_metadata={"groupName": [session_id]},
    )
    contexts = response.contexts or []
    return [context.content for context in contexts if context.content]


def ensure_seeded(
    client: AlchemystAI,
    *,
    session_id: str,
    alice_id: str,
    bob_id: str,
) -> None:
    entries = [
        {
            "phrase": ALICE_PHRASE,
            "content": f"{ALICE_PHRASE}. Contributor: {alice_id}",
            "message_id": f"{session_id}-alice-seed",
        },
        {
            "phrase": BOB_PHRASE,
            "content": f"{BOB_PHRASE}. Contributor: {bob_id}",
            "message_id": f"{session_id}-bob-seed",
        },
    ]

    contents: List[dict] = []
    for entry in entries:
        existing = search_session(
            client,
            session_id=session_id,
            query=entry["phrase"],
        )
        if any(entry["phrase"] in snippet for snippet in existing):
            continue
        contents.append(
            {
                "content": entry["content"],
                "metadata": {"message_id": entry["message_id"]},
            }
        )

    if contents:
        client.v1.context.memory.add(
            session_id=session_id,
            metadata={"group_name": [session_id]},
            contents=contents,
        )


def retrieve_snippets(
    client: AlchemystAI,
    *,
    session_id: str,
    query: str,
    required_phrases: Iterable[str],
    retries: int = 5,
    delay_seconds: float = 1.0,
) -> List[str]:
    required = list(required_phrases)
    queries = [query] + required

    for attempt in range(retries):
        snippets: List[str] = []
        for search_query in queries:
            snippets.extend(
                search_session(
                    client,
                    session_id=session_id,
                    query=search_query,
                )
            )
        unique_snippets = list(dict.fromkeys(snippets))
        if all(any(phrase in snippet for snippet in unique_snippets) for phrase in required):
            return unique_snippets
        if attempt < retries - 1:
            time.sleep(delay_seconds)

    return list(dict.fromkeys(snippets))


def main() -> None:
    parser = argparse.ArgumentParser(description="Shared Team Memory CLI")
    parser.add_argument("--user-id", required=True, help="Calling user ID")
    parser.add_argument("--query", required=True, help="Search query")
    args = parser.parse_args()

    api_key = require_env("ALCHEMYST_AI_API_KEY")
    run_id = require_env("ZEALT_RUN_ID")
    ids = build_session_ids(run_id)

    if args.user_id not in {ids["alice_id"], ids["bob_id"]}:
        print(
            f"--user-id must be {ids['alice_id']} or {ids['bob_id']}",
            file=sys.stderr,
        )
        sys.exit(1)

    client = AlchemystAI(api_key=api_key)

    ensure_seeded(
        client,
        session_id=ids["session_id"],
        alice_id=ids["alice_id"],
        bob_id=ids["bob_id"],
    )

    snippets = retrieve_snippets(
        client,
        session_id=ids["session_id"],
        query=args.query,
        required_phrases=[ALICE_PHRASE, BOB_PHRASE],
    )

    print(f"USER: {args.user_id}")
    print(f"SESSION: {ids['session_id']}")
    print("RETRIEVED:")
    for snippet in snippets:
        print(f"- {snippet}")


if __name__ == "__main__":
    main()
