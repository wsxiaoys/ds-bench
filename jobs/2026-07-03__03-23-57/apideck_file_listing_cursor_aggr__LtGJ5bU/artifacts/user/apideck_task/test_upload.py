import os
import requests
import json

api_key = os.environ.get("APIDECK_API_KEY")
app_id = os.environ.get("APIDECK_APP_ID")
consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
drive_name = os.environ.get("APIDECK_FILE_STORAGE_DRIVE_NAME")

# Get run-id
with open("/logs/artifacts/run-id", "r") as f:
    run_id = f.read().strip()

print(f"Run ID: {run_id}")

# Let's list drives to find the drive ID of the drive named 'REDACTED' (or drive_name)
headers = {
    "Authorization": f"Bearer {api_key}",
    "x-apideck-app-id": app_id,
    "x-apideck-consumer-id": consumer_id,
    "x-apideck-service-id": "onedrive"
}

drives_url = "https://unify.apideck.com/file-storage/drives"
response = requests.get(drives_url, headers=headers)
drives = response.json().get("data", [])
drive_id = None
for d in drives:
    if d.get("name") == drive_name:
        drive_id = d.get("id")
        break

if not drive_id:
    print(f"Drive '{drive_name}' not found!")
    exit(1)

print(f"Found drive ID: {drive_id}")

# Let's try uploading 1 test file
filename = f"AGG-{run_id}-1.txt"
content = f"This is test file 1 for run {run_id}"

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

print(f"Uploading file {filename}...")
upload_response = requests.post(upload_url, headers=upload_headers, data=content.encode('utf-8'))
print("Status Code:", upload_response.status_code)
try:
    print(json.dumps(upload_response.json(), indent=2))
except Exception as e:
    print("Error parsing JSON:", e)
    print("Response text:", upload_response.text)
