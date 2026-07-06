import argparse
import os
import sys
from convex import ConvexClient

def main():
    parser = argparse.ArgumentParser(description="Convex Python SDK CLI Integration")
    parser.add_argument("--add", type=str, help="Add a task with the specified text")
    parser.add_argument("--status", type=str, default="todo", help="Status of the task (defaults to 'todo')")
    parser.add_argument("--list", action="store_true", help="List all tasks")
    
    args = parser.parse_args()
    
    convex_url = os.environ.get("CONVEX_URL")
    if not convex_url:
        print("Error: CONVEX_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)
        
    client = ConvexClient(convex_url)
    
    if args.add:
        print(f"Adding task: {args.add} (status: {args.status})")
        result = client.mutation("tasks:add", {"text": args.add, "status": args.status})
        print(f"Task added successfully. ID: {result}")
        
    if args.list:
        print("Fetching tasks...")
        tasks = client.query("tasks:get")
        print("Tasks:")
        for task in tasks:
            print(f"- {task.get('text')} [{task.get('status')}] (ID: {task.get('_id')})")

if __name__ == "__main__":
    main()
