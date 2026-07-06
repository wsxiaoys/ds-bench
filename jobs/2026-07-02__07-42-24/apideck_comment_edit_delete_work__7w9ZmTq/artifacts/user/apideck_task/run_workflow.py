import os
import sys
import time
import requests

def main():
    # 1. Read all credentials and environment variables
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")
    service_id = "github"

    print(f"API Key: {api_key[:10]}...{api_key[-10:] if api_key else ''}")
    print(f"App ID: {app_id}")
    print(f"Consumer ID: {consumer_id}")
    print(f"Collection ID: {collection_id}")

    if not all([api_key, app_id, consumer_id, collection_id]):
        print("Error: Missing required environment variables.", file=sys.stderr)
        sys.exit(1)

    # Read run ID
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: Run ID file not found at {run_id_path}", file=sys.stderr)
        sys.exit(1)
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
    print(f"Run ID: {run_id}")

    # Set up headers
    headers = {
        "Authorization": f"Bearer {api_key}",
        "x-apideck-app-id": app_id,
        "x-apideck-consumer-id": consumer_id,
        "x-apideck-service-id": service_id,
        "Content-Type": "application/json",
        "accept": "application/json"
    }

    base_url = "https://unify.apideck.com"

    # 2. Create Ticket
    ticket_subject = f"[COMMENT-EDIT-DELETE] Run {run_id}"
    ticket_payload = {
        "subject": ticket_subject,
        "description": f"Ticket created for comment edit/delete workflow test. Run ID: {run_id}"
    }
    
    ticket_url = f"{base_url}/issue-tracking/collections/{collection_id}/tickets"
    print(f"\n--- Creating Ticket ---")
    print(f"POST {ticket_url}")
    print(f"Payload: {ticket_payload}")
    
    response = requests.post(ticket_url, json=ticket_payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    try:
        res_json = response.json()
        print(f"Response: {res_json}")
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Response Text: {response.text}")
        sys.exit(1)

    if response.status_code not in [200, 201]:
        print("Error: Failed to create ticket.", file=sys.stderr)
        sys.exit(1)

    ticket_id = res_json["data"]["id"]
    print(f"Created Ticket ID: {ticket_id}")

    # Write Ticket ID to output log immediately to ensure we have it
    output_dir = "/home/user/apideck_task"
    os.makedirs(output_dir, exist_ok=True)
    output_log_path = os.path.join(output_dir, "output.log")
    with open(output_log_path, "w") as f:
        f.write(f"Ticket ID: {ticket_id}\n")
    print(f"Wrote Ticket ID to {output_log_path}")

    # 3. Add 4 comments in sequence
    comments_to_add = [
        f"A-{run_id}",
        f"B-{run_id}",
        f"C-{run_id}",
        f"D-{run_id}"
    ]
    
    created_comment_ids = {}
    
    comments_url = f"{base_url}/issue-tracking/collections/{collection_id}/tickets/{ticket_id}/comments"
    
    for body_text in comments_to_add:
        print(f"\n--- Adding Comment: {body_text} ---")
        comment_payload = {
            "body": body_text
        }
        print(f"POST {comments_url}")
        print(f"Payload: {comment_payload}")
        
        # We can add a small retry loop for robustness
        for attempt in range(3):
            res = requests.post(comments_url, json=comment_payload, headers=headers)
            print(f"Attempt {attempt+1} - Status Code: {res.status_code}")
            try:
                rj = res.json()
                print(f"Response: {rj}")
                if res.status_code in [200, 201]:
                    comment_id = rj["data"]["id"]
                    created_comment_ids[body_text] = comment_id
                    print(f"Comment {body_text} created with ID: {comment_id}")
                    break
            except Exception as e:
                print(f"Error parsing response: {e}")
                print(f"Response text: {res.text}")
            time.sleep(2)
        else:
            print(f"Error: Failed to add comment {body_text} after multiple attempts.", file=sys.stderr)
            sys.exit(1)
        
        # Wait a bit between comments to ensure GitHub processes them in sequence
        time.sleep(2)

    # 4. Edit comment B in-place to B-EDITED
    target_b_body = f"B-{run_id}"
    edited_b_body = f"B-EDITED-{run_id}"
    
    # We retrieve the comment ID from created_comment_ids
    b_comment_id = created_comment_ids.get(target_b_body)
    if not b_comment_id:
        print(f"Error: Could not find recorded comment ID for {target_b_body}", file=sys.stderr)
        sys.exit(1)
        
    print(f"\n--- Editing Comment {target_b_body} (ID: {b_comment_id}) to {edited_b_body} ---")
    edit_url = f"{base_url}/issue-tracking/collections/{collection_id}/tickets/{ticket_id}/comments/{b_comment_id}"
    edit_payload = {
        "body": edited_b_body
    }
    print(f"PATCH {edit_url}")
    print(f"Payload: {edit_payload}")
    
    for attempt in range(3):
        res = requests.patch(edit_url, json=edit_payload, headers=headers)
        print(f"Attempt {attempt+1} - Status Code: {res.status_code}")
        try:
            rj = res.json()
            print(f"Response: {rj}")
            if res.status_code in [200, 201]:
                print(f"Comment edited successfully!")
                break
        except Exception as e:
            print(f"Error parsing response: {e}")
            print(f"Response text: {res.text}")
        time.sleep(2)
    else:
        print(f"Error: Failed to edit comment {target_b_body}.", file=sys.stderr)
        sys.exit(1)

    # 5. Delete comment C
    target_c_body = f"C-{run_id}"
    c_comment_id = created_comment_ids.get(target_c_body)
    if not c_comment_id:
        print(f"Error: Could not find recorded comment ID for {target_c_body}", file=sys.stderr)
        sys.exit(1)
        
    print(f"\n--- Deleting Comment {target_c_body} (ID: {c_comment_id}) ---")
    delete_url = f"{base_url}/issue-tracking/collections/{collection_id}/tickets/{ticket_id}/comments/{c_comment_id}"
    print(f"DELETE {delete_url}")
    
    for attempt in range(3):
        res = requests.delete(delete_url, headers=headers)
        print(f"Attempt {attempt+1} - Status Code: {res.status_code}")
        try:
            rj = res.json()
            print(f"Response: {rj}")
            if res.status_code in [200, 201]:
                print(f"Comment deleted successfully!")
                break
        except Exception as e:
            print(f"Error parsing response: {e}")
            print(f"Response text: {res.text}")
        time.sleep(2)
    else:
        print(f"Error: Failed to delete comment {target_c_body}.", file=sys.stderr)
        sys.exit(1)

    # 6. Verify final state
    # Let's list comments on the ticket. Since pagination is possible, we'll write a paginated fetcher.
    print(f"\n--- Verifying Comments on Ticket {ticket_id} ---")
    
    def list_all_comments():
        all_comments = []
        cursor = None
        while True:
            params = {}
            if cursor:
                params["cursor"] = cursor
            
            print(f"GET {comments_url} with params: {params}")
            res = requests.get(comments_url, headers=headers, params=params)
            if res.status_code != 200:
                print(f"Error: Failed to list comments. Status: {res.status_code}", file=sys.stderr)
                print(res.text, file=sys.stderr)
                sys.exit(1)
                
            rj = res.json()
            all_comments.extend(rj.get("data", []))
            
            # Check for next cursor
            cursor = rj.get("meta", {}).get("cursors", {}).get("next")
            if not cursor:
                break
        return all_comments

    # Wait a moment for changes to propagate to GitHub
    time.sleep(5)

    # Let's verify multiple times with delay if needed, up to 30 seconds
    expected_bodies = {f"A-{run_id}", f"B-EDITED-{run_id}", f"D-{run_id}"}
    
    verified = False
    for check_attempt in range(6):
        print(f"Verification Check {check_attempt+1}...")
        comments = list_all_comments()
        bodies_found = [c.get("body") for c in comments]
        print(f"Comments found on ticket: {bodies_found}")
        
        if set(bodies_found) == expected_bodies and len(bodies_found) == 3:
            print("SUCCESS: Comment list perfectly matches the expected state!")
            verified = True
            break
        else:
            print("State does not match yet. Waiting before retrying...")
            time.sleep(5)
            
    if not verified:
        print("ERROR: Verification failed. The comments on the ticket did not match the expected state.", file=sys.stderr)
        sys.exit(1)

    print("\nWorkflow completed successfully!")

if __name__ == "__main__":
    main()
