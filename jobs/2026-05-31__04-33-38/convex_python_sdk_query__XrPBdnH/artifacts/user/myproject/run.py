import os
import argparse
from convex import ConvexClient

def main():
    parser = argparse.ArgumentParser(description="Convex Python SDK Task Manager")
    parser.add_argument("--add", type=str, help="Add a new task with the given text")
    parser.add_argument("--list", action="store_true", help="List all tasks")
    args = parser.parse_args()

    convex_url = os.environ.get("CONVEX_URL")
    if not convex_url:
        print("Error: CONVEX_URL environment variable not set.")
        return

    client = ConvexClient(convex_url)

    if args.add:
        client.mutation("tasks:add", {"text": args.add, "status": "todo"})
        print(f"Added task: {args.add}")

    if args.list:
        tasks = client.query("tasks:get")
        for task in tasks:
            print(f"{task['text']} [{task['status']}]")

if __name__ == "__main__":
    main()
