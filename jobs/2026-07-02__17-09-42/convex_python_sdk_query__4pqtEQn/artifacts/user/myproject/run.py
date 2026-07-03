#!/usr/bin/env python3
"""Simple CLI to interact with a Convex backend using the official Python SDK.

Usage:
    python3 run.py --add "<task text>"        # Insert a task with status="todo"
    python3 run.py --add "<task text>" --status in_progress
    python3 run.py --list                     # Print all tasks
"""

import argparse
import json
import os
import sys

from convex import ConvexClient


def get_client() -> ConvexClient:
    """Construct a ConvexClient using the CONVEX_URL environment variable.

    The CONVEX_URL environment variable is REDACTEDmatically injected by the
    Convex CLI when this script is run via `npx convex deploy --cmd ...`.
    """
    deployment_url = os.environ.get("CONVEX_URL")
    if not deployment_url:
        print(
            "Error: CONVEX_URL environment variable is not set. "
            "Run this script via `npx convex deploy --cmd \"python3 run.py ...\"`.",
            file=sys.stderr,
        )
        sys.exit(1)
    return ConvexClient(deployment_url)


def add_task(client: ConvexClient, text: str, status: str) -> None:
    """Call the `tasks:add` mutation to insert a new task."""
    result = client.mutation("tasks:add", {"text": text, "status": status})
    print(f"Added task with id: {result}")


def list_tasks(client: ConvexClient) -> None:
    """Call the `tasks:get` query and print all tasks to stdout."""
    tasks = client.query("tasks:get")
    print(json.dumps(tasks, indent=2, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Interact with the Convex `tasks` table.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--add",
        metavar="TEXT",
        help="Add a new task with the given text (status defaults to 'todo').",
    )
    group.add_argument(
        "--list",
        action="store_true",
        help="List all tasks currently in the table.",
    )
    parser.add_argument(
        "--status",
        default="todo",
        help="Status string to use when adding a task (default: 'todo').",
    )

    args = parser.parse_args()

    client = get_client()

    if args.add is not None:
        add_task(client, args.add, args.status)
    elif args.list:
        list_tasks(client)


if __name__ == "__main__":
    main()