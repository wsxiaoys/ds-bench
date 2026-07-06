import os
import sys
import requests

def run_workflow():
    # 1. Read environment variables
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")

    if not all([api_key, app_id, consumer_id, collection_id]):
        print("Error: Missing one or more required Apideck environment variables.")
        print(f"APIDECK_API_KEY: {'set' if api_key else 'not set'}")
        print(f"APIDECK_APP_ID: {'set' if app_id else 'not set'}")
        print(f"APIDECK_CONSUMER_ID: {'set' if consumer_id else 'not set'}")
        print(f"APIDECK_ISSUE_TRACKING_COLLECTION_ID: {'set' if collection_id else 'not set'}")
        sys.exit(1)

    # 2. Read run-id from /logs/artifacts/run-id
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: Run ID file not found at {run_id_path}")
        sys.exit(1)
        
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
    
    print(f"Loaded Run ID: {run_id}")

    # 3. Construct Headers
    headers = {
        "Authorization": f"Bearer {api_key}",
        "x-apideck-app-id": app_id,
        "x-apideck-consumer-id": consumer_id,
        "x-apideck-service-id": "github",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    base_url = "https://unify.apideck.com"
    
    # 4. Create Ticket (POST)
    create_url = f"{base_url}/issue-tracking/collections/{collection_id}/tickets"
    initial_subject = f"[UPDATE-V1] {run_id}"
    initial_description = "Initial draft v1"
    
    create_payload = {
        "subject": initial_subject,
        "description": initial_description
    }

    print(f"Creating ticket at {create_url}...")
    print(f"Payload: {create_payload}")
    
    response = requests.post(create_url, headers=headers, json=create_payload)
    print(f"Create Ticket Response Status: {response.status_code}")
    
    try:
        response_data = response.json()
    except Exception as e:
        print(f"Failed to parse response JSON: {response.text}")
        sys.exit(1)

    if not response.ok:
        print(f"Error creating ticket: {response_data}")
        sys.exit(1)

    ticket_id = response_data.get("data", {}).get("id")
    if not ticket_id:
        print(f"Error: Ticket created but no ID returned in response: {response_data}")
        sys.exit(1)

    print(f"Successfully created ticket. ID: {ticket_id}")

    # 5. Update Ticket (PATCH)
    update_url = f"{base_url}/issue-tracking/collections/{collection_id}/tickets/{ticket_id}"
    updated_subject = f"[UPDATE-V2] {run_id}"
    updated_description = "Revised draft v2"
    
    update_payload = {
        "id": ticket_id,
        "subject": updated_subject,
        "description": updated_description
    }

    print(f"Updating ticket at {update_url}...")
    print(f"Payload: {update_payload}")
    
    response = requests.patch(update_url, headers=headers, json=update_payload)
    print(f"Update Ticket Response Status: {response.status_code}")
    
    try:
        update_response_data = response.json()
    except Exception as e:
        print(f"Failed to parse update response JSON: {response.text}")
        sys.exit(1)

    if not response.ok:
        print(f"Error updating ticket: {update_response_data}")
        sys.exit(1)

    print(f"Successfully updated ticket {ticket_id}.")

    # 6. Record the resulting ticket identifier to the log file
    log_dir = "/home/user/apideck_task"
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "output.log")
    
    with open(log_path, "w") as log_file:
        log_file.write(f"Ticket ID: {ticket_id}\n")
        
    print(f"Recorded ticket ID to {log_path}")

if __name__ == "__main__":
    run_workflow()
