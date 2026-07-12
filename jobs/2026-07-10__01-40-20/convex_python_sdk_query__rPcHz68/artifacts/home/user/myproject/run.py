#!/usr/bin/env python3
"""Script to interact with a Convex backend using the Python SDK.

Usage:
    python3 run.py --add "Buy groceries"
    python3 run.py --list
"""

import argparse
import json
import os
import sys

from convex import ConvexClient


def main():
    parser = argparse.ArgumentParser(
        description="Interact with a Convex backend tasks table."
    )
    parser.add_argument(
        "--add",
        metavar="TEXT",
        help="Add a new task with the given text (status defaults to 'todo').",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all tasks from the backend.",
    )
    args = parser.parse_args()

    # The CONVEX_URL environment variable is injected by `npx convex deploy --cmd`
    # or can be set manually.
    convex_url = os.environ.get("CONVEX_URL")
    if not convex_url:
        print("Error: CONVEX_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = ConvexClient(convex_url)

    if args.add is not None:
        # Call the tasks:add mutation with text and default status 'todo'
        result = client.mutation(
            "tasks:add",
            {
                "text": args.add,
                "status": "todo",
            },
        )
        print(f"Added task with id: {result}")

    if args.list:
        # Call the tasks:get query and print all tasks
        tasks = client.query("tasks:get")
        print(json.dumps(tasks, indent=2, default=str))

    if args.add is None and not args.list:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()