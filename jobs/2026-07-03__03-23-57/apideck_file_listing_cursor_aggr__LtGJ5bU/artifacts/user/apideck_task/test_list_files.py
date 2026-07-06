import os
import requests
import json

api_key = os.environ.get("APIDECK_API_KEY")
app_id = os.environ.get("APIDECK_APP_ID")
consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
drive_id = "3ADA079B78534FF1"

headers = {
    "Authorization": f"Bearer {api_key}",
    "x-apideck-app-id": app_id,
    "x-apideck-consumer-id": consumer_id,
    "x-apideck-service-id": "onedrive"
}

# Try 1: No filters
print("=== Try 1: No filters ===")
url1 = "https://unify.apideck.com/file-storage/files?limit=3"
response1 = requests.get(url1, headers=headers)
print("Status Code:", response1.status_code)
try:
    print(json.dumps(response1.json(), indent=2))
except Exception as e:
    print("Error:", e, response1.text)

# Try 2: With filter[drive_id] and filter[folder_id]
print("\n=== Try 2: filter[drive_id] and filter[folder_id] ===")
url2 = "https://unify.apideck.com/file-storage/files?filter[drive_id]=3ADA079B78534FF1&filter[folder_id]=root&limit=3"
response2 = requests.get(url2, headers=headers)
print("Status Code:", response2.status_code)
try:
    print(json.dumps(response2.json(), indent=2))
except Exception as e:
    print("Error:", e, response2.text)
