import os
import json
import requests

def main():
    # 1. Read the run-id from /logs/artifacts/run-id
    run_id_path = "/logs/artifacts/run-id"
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
    
    print(f"Retrieved run-id: {run_id}")

    api_key = os.getenv("APIDECK_API_KEY")
    app_id = os.getenv("APIDECK_APP_ID")
    consumer_id = os.getenv("APIDECK_CONSUMER_ID")
    collection_id = os.getenv("APIDECK_ISSUE_TRACKING_COLLECTION_ID")

    # 2. Upload exactly three small text files to REDACTED drive root
    files_to_upload = [
        {"name": f"REPORT-{run_id}-A.txt", "content": f"REPORT-{run_id}-A content"},
        {"name": f"REPORT-{run_id}-B.txt", "content": f"REPORT-{run_id}-B content"},
        {"name": f"REPORT-{run_id}-C.txt", "content": f"REPORT-{run_id}-C content"}
    ]

    file_ids = []
    upload_url = "https://upload.apideck.com/file-storage/files"

    for file_info in files_to_upload:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "x-apideck-app-id": app_id,
            "x-apideck-consumer-id": consumer_id,
            "x-apideck-service-id": "onedrive",
            "Content-Type": "text/plain",
            "x-apideck-metadata": json.dumps({
                "name": file_info["name"],
                "parent_folder_id": "root"
            })
        }
        
        print(f"Uploading file: {file_info['name']}")
        response = requests.post(upload_url, headers=headers, data=file_info["content"])
        if response.status_code not in (200, 201):
            print(f"Failed to upload {file_info['name']}. Status: {response.status_code}")
            print(f"Response: {response.text}")
            raise Exception(f"Upload failed for {file_info['name']}")
        
        res_json = response.json()
        file_id = res_json["data"]["id"]
        print(f"Uploaded successfully. File ID: {file_id}")
        file_ids.append(file_id)

    # 3. Sort the file IDs ascending
    sorted_file_ids = sorted(file_ids)
    print("Sorted file IDs:")
    for fid in sorted_file_ids:
        print(fid)

    # 4. Formulate the description and subject
    description = "\n".join(sorted_file_ids)
    subject = f"Ticket for /logs/artifacts/run-id [FILE-INDEX] (run-id: {run_id})"

    print(f"Subject: {subject}")
    print(f"Description:\n{description}")

    # 5. Create exactly one Issue Tracking ticket
    ticket_url = f"https://unify.apideck.com/issue-tracking/collections/{collection_id}/tickets"
    ticket_headers = {
        "Authorization": f"Bearer {api_key}",
        "x-apideck-app-id": app_id,
        "x-apideck-consumer-id": consumer_id,
        "x-apideck-service-id": "github",
        "Content-Type": "application/json"
    }
    ticket_payload = {
        "subject": subject,
        "description": description
    }

    print(f"Creating ticket at {ticket_url}")
    ticket_response = requests.post(ticket_url, headers=ticket_headers, json=ticket_payload)
    if ticket_response.status_code not in (200, 201):
        print(f"Failed to create ticket. Status: {ticket_response.status_code}")
        print(f"Response: {ticket_response.text}")
        raise Exception("Ticket creation failed")

    ticket_res_json = ticket_response.json()
    print("Ticket created successfully!")
    print(f"Ticket ID: {ticket_res_json['data']['id']}")

if __name__ == "__main__":
    main()
