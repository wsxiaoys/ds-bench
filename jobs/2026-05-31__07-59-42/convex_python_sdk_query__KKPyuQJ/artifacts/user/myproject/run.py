import argparse
import os
import json
from convex import ConvexClient

def main():
    parser = argparse.ArgumentParser(description="Convex tasks CLI")
    parser.add_argument("--add", metavar="TEXT", help="Add a task with the given text")
    parser.add_argument("--list", action="store_true", help="List all tasks")
    args = parser.parse_args()

    convex_url = os.environ.get("CONVEX_URL")
    client = ConvexClient(convex_url)

    if args.add is not None:
        result = client.mutation("tasks:add", {"text": args.add, "status": "todo"})
        print(f"Added task: {args.add}")
    elif args.list:
        tasks = client.query("tasks:get")
        print(json.dumps(tasks, indent=2))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()