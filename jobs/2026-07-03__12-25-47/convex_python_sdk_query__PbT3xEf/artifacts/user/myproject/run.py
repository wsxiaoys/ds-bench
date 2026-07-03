import argparse
import os
import sys
from convex import ConvexClient


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--add", type=str, default=None, help="Text of task to add")
    parser.add_argument("--list", action="store_true", help="List all tasks")
    parser.add_argument("--status", type=str, default="todo", help="Status of task to add")
    args = parser.parse_args()

    convex_url = os.environ.get("CONVEX_URL")
    if convex_url is None:
        print("CONVEX_URL environment variable not set", file=sys.stderr)
        sys.exit(1)

    client = ConvexClient(convex_url)

    if args.add is not None:
        client.mutation("tasks:add", {"text": args.add, "status": args.status})

    if args.list:
        result = client.query("tasks:get", {})
        print(result)


if __name__ == "__main__":
    main()
