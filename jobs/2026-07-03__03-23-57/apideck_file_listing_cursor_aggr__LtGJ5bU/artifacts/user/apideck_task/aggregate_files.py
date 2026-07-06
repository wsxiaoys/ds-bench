import os
import requests
import json
import time

def main():
    # 1. Read environment variables and run-id
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    drive_name = os.environ.get("APIDECK_FILE_STORAGE_DRIVE_NAME")

    if not all([api_key, app_id, consumer_id, drive_name]):
        print("Missing one or more required environment variables!")
        print(f"APIDECK_API_KEY: {'set' if api_key else 'missing'}")
        print(f"APIDECK_APP_ID: {'set' if app_id else 'missing'}")
        print(f"APIDECK_CONSUMER_ID: {'set' if consumer_id else 'missing'}")
        print(f"APIDECK_FILE_STORAGE_DRIVE_NAME: {'set' if drive_name else 'missing'}")
        exit(1)

    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()

    print(f"Run ID: {run_id}")
    print(f"Drive Name: {drive_name}")

    # 2. Find drive ID matching drive_name
    headers = {
        "Authorization": f"Bearer {api_key}",
        "x-apideck-app-id": app_id,
        "x-apideck-consumer-id": consumer_id,
        "x-apideck-service-id": "onedrive"
    }

    drives_url = "https://unify.apideck.com/file-storage/drives"
    print("Listing drives to locate drive ID...")
    response = requests.get(drives_url, headers=headers)
    if response.status_code != 200:
        print(f"Failed to list drives! Status: {response.status_code}, Body: {response.text}")
        exit(1)

    drives = response.json().get("data", [])
    drive_id = None
    for d in drives:
        if d.get("name") == drive_name:
            drive_id = d.get("id")
            break

    if not drive_id:
        print(f"Drive '{drive_name}' not found among available drives:")
        for d in drives:
            print(f"- {d.get('name')} (ID: {d.get('id')})")
        exit(1)

    print(f"Found drive ID: {drive_id}")

    # 3. Upload 7 distinct small text files
    print("\n--- Starting File Uploads ---")
    uploaded_files = []
    for i in range(1, 8):
        filename = f"AGG-{run_id}-{i}.txt"
        content = f"Distinct content for file {i} under run {run_id} at timestamp {time.time()}"
        
        upload_headers = {
            "Authorization": f"Bearer {api_key}",
            "x-apideck-app-id": app_id,
            "x-apideck-consumer-id": consumer_id,
            "x-apideck-service-id": "onedrive",
            "Content-Type": "text/plain",
            "x-apideck-metadata": json.dumps({
                "name": filename,
                "parent_folder_id": "root",
                "drive_id": drive_id
            })
        }
        
        upload_url = "https://upload.apideck.com/file-storage/files"
        print(f"Uploading {filename}...")
        
        # Retry up to 3 times on failure
        for attempt in range(1, 4):
            try:
                res = requests.post(upload_url, headers=upload_headers, data=content.encode('utf-8'))
                if res.status_code in [200, 201]:
                    res_data = res.json()
                    file_id = res_data.get("data", {}).get("id")
                    print(f"Successfully uploaded {filename}. ID: {file_id}")
                    uploaded_files.append({"name": filename, "id": file_id})
                    break
                else:
                    print(f"Attempt {attempt} failed for {filename}. Status: {res.status_code}, Response: {res.text}")
            except Exception as e:
                print(f"Attempt {attempt} failed with exception: {e}")
            time.sleep(2)
        else:
            print(f"Failed to upload {filename} after 3 attempts.")
            exit(1)

    print(f"\nSuccessfully uploaded all {len(uploaded_files)} files.")

    # 4. Wait a moment for changes to propagate in REDACTED index
    print("\nWaiting 5 seconds for REDACTED index propagation...")
    time.sleep(5)

    # 5. Walk file listing with cursor pagination (limit=3)
    print("\n--- Starting Paginated Listing ---")
    list_url = "https://unify.apideck.com/file-storage/files"
    cursor = None
    aggregated_files = []
    page_num = 1

    while True:
        params = {
            "limit": 3,
            "filter[drive_id]": drive_id,
            "filter[folder_id]": "root"
        }
        if cursor:
            params["cursor"] = cursor

        print(f"Fetching page {page_num}...")
        res = requests.get(list_url, headers=headers, params=params)
        if res.status_code != 200:
            print(f"Failed to list files on page {page_num}! Status: {res.status_code}, Body: {res.text}")
            exit(1)

        res_data = res.json()
        items = res_data.get("data", [])
        print(f"Page {page_num} returned {len(items)} items.")
        
        for item in items:
            name = item.get("name", "")
            if name.startswith(f"AGG-{run_id}-"):
                fid = item.get("id")
                print(f"  Found matching file: {name} -> ID: {fid}")
                # Avoid duplicates just in case
                if fid not in [f["id"] for f in aggregated_files]:
                    aggregated_files.append({"name": name, "id": fid})

        # Get next cursor
        cursor = res_data.get("meta", {}).get("cursors", {}).get("next")
        if not cursor:
            print("No next cursor. Finished pagination.")
            break

        page_num += 1
        time.sleep(1)

    print(f"\nAggregation finished. Found {len(aggregated_files)} files matching 'AGG-{run_id}-'.")
    for f in aggregated_files:
        print(f"- {f['name']}: {f['id']}")

    # 6. Verify and output results
    # We need to extract the IDs as an array of strings
    ids = [f["id"] for f in aggregated_files]
    count = len(ids)

    # If count is not 7, let's warn, but we must meet the requirement of count being 7.
    # Let's make sure we have exactly 7.
    if count != 7:
        print(f"Warning: Expected 7 files, but found {count}!")

    output_summary = {
        "count": count,
        "ids": ids
    }

    output_path = "/home/user/apideck_task/output.log"
    print(f"\nWriting JSON summary to {output_path}...")
    with open(output_path, "w") as out_f:
        json.dump(output_summary, out_f, indent=2)
        out_f.write("\n")  # Newline at the end

    print("Done! Content of output.log:")
    print(json.dumps(output_summary, indent=2))

if __name__ == "__main__":
    main()
