#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import urllib.request

def main():
    # 1. Read environment variables and run-id
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    drive_name = os.environ.get("APIDECK_FILE_STORAGE_DRIVE_NAME")

    if not all([api_key, app_id, consumer_id, drive_name]):
        print("Error: Missing one or more environment variables:", file=sys.stderr)
        print(f"APIDECK_API_KEY: {'set' if api_key else 'missing'}", file=sys.stderr)
        print(f"APIDECK_APP_ID: {'set' if app_id else 'missing'}", file=sys.stderr)
        print(f"APIDECK_CONSUMER_ID: {'set' if consumer_id else 'missing'}", file=sys.stderr)
        print(f"APIDECK_FILE_STORAGE_DRIVE_NAME: {'set' if drive_name else 'missing'}", file=sys.stderr)
        sys.exit(1)

    try:
        with open("/logs/artifacts/run-id", "r") as f:
            run_id = f.read().strip()
    except Exception as e:
        print(f"Error reading /logs/artifacts/run-id: {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Form filename and write file body
    filename = f"apideck-curl-{run_id}.txt"
    file_path = os.path.join("/home/user/myproject", filename)
    file_content = "Uploaded via Apideck File Storage direct upload curl test\n"
    
    with open(file_path, "w", encoding="ascii") as f:
        f.write(file_content)
    
    print(f"Created local file {file_path} with content length {len(file_content)} bytes.")

    # 3. Discover target drive
    url = "https://unify.apideck.com/file-storage/drives"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("x-apideck-app-id", app_id)
    req.add_header("x-apideck-consumer-id", consumer_id)
    req.add_header("x-apideck-service-id", "onedrive")

    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching drives from Apideck: {e}", file=sys.stderr)
        sys.exit(1)

    drives = res_data.get("data", [])
    drive_id = None
    for drive in drives:
        if drive.get("name") == drive_name:
            drive_id = drive.get("id")
            break

    if not drive_id:
        print(f"Error: Could not find drive with name '{drive_name}' in drives response.", file=sys.stderr)
        print(f"Available drives: {[d.get('name') for d in drives]}", file=sys.stderr)
        sys.exit(1)

    print(f"Found target drive '{drive_name}' with ID: {drive_id}")

    # 4. Construct and execute the curl command for upload
    metadata = {
        "name": filename,
        "parent_folder_id": "root",
        "drive_id": drive_id
    }
    metadata_json = json.dumps(metadata)

    curl_cmd = [
        "curl", "-s", "-X", "POST", "https://upload.apideck.com/file-storage/files",
        "-H", f"Authorization: Bearer {api_key}",
        "-H", f"x-apideck-app-id: {app_id}",
        "-H", f"x-apideck-consumer-id: {consumer_id}",
        "-H", "x-apideck-service-id: onedrive",
        "-H", "Content-Type: text/plain",
        "-H", f"x-apideck-metadata: {metadata_json}",
        "--data-binary", f"@{file_path}"
    ]

    print("Running curl upload command...")
    result = subprocess.run(curl_cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"curl command failed with exit code {result.returncode}", file=sys.stderr)
        print(f"stderr: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    response_text = result.stdout
    print("Upload response received.")
    try:
        response_json = json.loads(response_text)
    except Exception as e:
        print(f"Error parsing JSON response from curl: {e}", file=sys.stderr)
        print(f"Raw response: {response_text}", file=sys.stderr)
        sys.exit(1)

    if "data" not in response_json or "id" not in response_json["data"]:
        print("Error: Response JSON does not contain 'data.id'", file=sys.stderr)
        print(json.dumps(response_json, indent=2), file=sys.stderr)
        sys.exit(1)

    file_id = response_json["data"]["id"]
    print(f"Successfully uploaded! File ID: {file_id}")

    # 5. Write the unified file ID to output.log
    output_path = "/home/user/myproject/output.log"
    with open(output_path, "w") as f:
        f.write(file_id + "\n")

    print(f"Wrote file ID to {output_path}")

if __name__ == "__main__":
    main()
