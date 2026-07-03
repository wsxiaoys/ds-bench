#!/usr/bin/env python3
import os
import json
import sys
from apideck_unify import Apideck
from apideck_unify.types import UNSET
from apideck_unify.types.basemodel import Unset

def clean_val(val):
    if val is UNSET or isinstance(val, Unset) or val is None:
        return None
    return str(val)

def main():
    # 1. Read credentials and configuration from environment variables
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")

    if not api_key:
        print("Error: APIDECK_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not app_id:
        print("Error: APIDECK_APP_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not consumer_id:
        print("Error: APIDECK_CONSUMER_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not collection_id:
        print("Error: APIDECK_ISSUE_TRACKING_COLLECTION_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # 2. Initialize Apideck Unified API client
    sdk = Apideck(
        api_key=api_key,
        app_id=app_id,
        consumer_id=consumer_id
    )

    # 3. Retrieve all users from the collection, traversing pagination
    users_list = []
    
    try:
        response = sdk.issue_tracking.collection_users.list(
            collection_id=collection_id,
            service_id="github",
            consumer_id=consumer_id,
            app_id=app_id
        )

        while response is not None:
            if response.get_collection_users_response and response.get_collection_users_response.data is not None:
                for user in response.get_collection_users_response.data:
                    uid = clean_val(user.id)
                    if not uid:
                        # Skip users with missing or empty id as per requirement:
                        # "Every user object's id value must be a non-empty string"
                        continue
                    
                    user_obj = {
                        "id": uid,
                        "name": clean_val(user.name),
                        "first_name": clean_val(user.first_name),
                        "last_name": clean_val(user.last_name),
                        "email": clean_val(user.email)
                    }
                    users_list.append(user_obj)
            
            # Advance to the next page
            response = response.next()

    except Exception as e:
        print(f"Error calling Apideck API: {e}", file=sys.stderr)
        sys.exit(1)

    # 4. Construct output JSON structure
    output_data = {
        "collection_id": collection_id,
        "service_id": "github",
        "users": users_list
    }

    # Ensure output directory exists
    output_dir = "/home/user/myproject"
    os.makedirs(output_dir, exist_ok=True)

    # Write users to JSON file
    json_path = os.path.join(output_dir, "users.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    # Write log line to output.log
    log_path = os.path.join(output_dir, "output.log")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"User count: {len(users_list)}\n")

    print(f"Successfully exported {len(users_list)} users to {json_path}")
    print(f"Logged total user count to {log_path}")

if __name__ == "__main__":
    main()
