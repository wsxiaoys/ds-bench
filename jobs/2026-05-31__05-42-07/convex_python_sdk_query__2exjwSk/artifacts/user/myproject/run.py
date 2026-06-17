import argparse
import os
from convex import ConvexClient

def main():
    parser = argparse.ArgumentParser(description='Convex tasks client')
    parser.add_argument('--add', type=str, help='Add a task with the given text')
    parser.add_argument('--list', action='store_true', help='List all tasks')

    args = parser.parse_args()

    convex_url = os.environ.get("CONVEX_URL")
    if not convex_url:
        print("CONVEX_URL environment variable is required")
        return

    client = ConvexClient(convex_url)

    if args.add:
        client.mutation("tasks:add", {"text": args.add, "status": "todo"})
        print(f"Added task: {args.add}")

    if args.list:
        tasks = client.query("tasks:get")
        print(tasks)

if __name__ == "__main__":
    main()
