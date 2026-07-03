import os
import sys
import json
import requests

def main():
    # 1. Read the run-id
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: run-id file not found at {run_id_path}", file=sys.stderr)
        sys.exit(1)
        
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
        
    if not run_id:
        print("Error: run-id is empty", file=sys.stderr)
        sys.exit(1)
        
    print(f"Resolved run-id: {run_id}")

    # 2. Get environment variables
    api_key = os.getenv("APIDECK_API_KEY")
    app_id = os.getenv("APIDECK_APP_ID")
    consumer_id = os.getenv("APIDECK_CONSUMER_ID")
    drive_name = os.getenv("APIDECK_FILE_STORAGE_DRIVE_NAME")

    if not all([api_key, app_id, consumer_id, drive_name]):
        print("Error: Missing required environment variables.", file=sys.stderr)
        print(f"APIDECK_API_KEY set: {bool(api_key)}", file=sys.stderr)
        print(f"APIDECK_APP_ID set: {bool(app_id)}", file=sys.stderr)
        print(f"APIDECK_CONSUMER_ID set: {bool(consumer_id)}", file=sys.stderr)
        print(f"APIDECK_FILE_STORAGE_DRIVE_NAME set: {bool(drive_name)}", file=sys.stderr)
        sys.exit(1)

    common_headers = {
        "Authorization": f"Bearer {api_key}",
        "x-apideck-app-id": app_id,
        "x-apideck-consumer-id": consumer_id,
        "x-apideck-service-id": "onedrive"
    }

    # 3. Resolve REDACTED drive ID
    print(f"Resolving drive ID for drive name: {drive_name}...")
    drives_url = "https://unify.apideck.com/file-storage/drives"
    response = requests.get(drives_url, headers=common_headers)
    if response.status_code != 200:
        print(f"Error listing drives: {response.status_code} - {response.text}", file=sys.stderr)
        sys.exit(1)
        
    drives_data = response.json().get("data", [])
    drive_id = None
    for drive in drives_data:
        if drive.get("name") == drive_name:
            drive_id = drive.get("id")
            break
            
    if not drive_id:
        print(f"Error: Could not find drive with name '{drive_name}'", file=sys.stderr)
        sys.exit(1)
        
    print(f"Resolved drive ID: {drive_id}")

    # 4. Create folder FOLDER-${run-id} at drive root
    folder_name = f"FOLDER-{run_id}"
    print(f"Creating folder '{folder_name}' at drive root...")
    folders_url = "https://unify.apideck.com/file-storage/folders"
    folder_payload = {
        "name": folder_name,
        "parent_folder_id": "root",
        "drive_id": drive_id
    }
    
    headers_json = common_headers.copy()
    headers_json["Content-Type"] = "application/json"
    
    response = requests.post(folders_url, headers=headers_json, json=folder_payload)
    if response.status_code not in (200, 201):
        print(f"Error creating folder: {response.status_code} - {response.text}", file=sys.stderr)
        sys.exit(1)
        
    folder_info = response.json()
    folder_id = folder_info.get("data", {}).get("id")
    if not folder_id:
        print(f"Error: Created folder response did not contain data.id: {folder_info}", file=sys.stderr)
        sys.exit(1)
        
    print(f"Successfully created folder. ID: {folder_id}")

    # 5. Upload exactly three text files into the folder
    file_ids = []
    upload_url = "https://upload.apideck.com/file-storage/files"
    
    for i in range(1, 4):
        file_name = f"NOTE-{run_id}-{i}.txt"
        file_content = f"This is run-scoped note number {i} for run-id {run_id}.\n"
        print(f"Uploading file '{file_name}' into folder '{folder_id}'...")
        
        metadata = {
            "name": file_name,
            "parent_folder_id": folder_id
        }
        
        upload_headers = common_headers.copy()
        upload_headers["Content-Type"] = "text/plain"
        upload_headers["x-apideck-metadata"] = json.dumps(metadata)
        
        response = requests.post(upload_url, headers=upload_headers, data=file_content.encode("utf-8"))
        if response.status_code not in (200, 201):
            print(f"Error uploading file {file_name}: {response.status_code} - {response.text}", file=sys.stderr)
            sys.exit(1)
            
        file_info = response.json()
        file_id = file_info.get("data", {}).get("id")
        if not file_id:
            print(f"Error: Uploaded file response did not contain data.id: {file_info}", file=sys.stderr)
            sys.exit(1)
            
        print(f"Successfully uploaded file '{file_name}'. ID: {file_id}")
        file_ids.append(file_id)

    # 6. Persist log file at /home/user/apideck_task/output.log
    output_log_path = "/home/user/apideck_task/output.log"
    log_data = {
        "folder_id": folder_id,
        "file_ids": file_ids
    }
    
    with open(output_log_path, "w") as f:
        f.write(json.dumps(log_data) + "\n")
        
    print(f"Successfully wrote log to {output_log_path}")
    print(json.dumps(log_data))

if __name__ == "__main__":
    main()
