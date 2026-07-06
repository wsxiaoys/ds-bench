import os
import requests

API_KEY = os.environ['APIDECK_API_KEY']
APP_ID = os.environ['APIDECK_APP_ID']
CONSUMER_ID = os.environ['APIDECK_CONSUMER_ID']
COLLECTION_ID = os.environ['APIDECK_ISSUE_TRACKING_COLLECTION_ID']
SERVICE_ID = 'github'

with open('/logs/artifacts/run-id', 'r') as f:
    run_id = f.read().strip()

HEADERS = {
    'Authorization': f'Bearer {API_KEY}',
    'x-apideck-app-id': APP_ID,
    'x-apideck-consumer-id': CONSUMER_ID,
    'x-apideck-service-id': SERVICE_ID,
    'Accept': 'application/json',
}

url = f'https://unify.apideck.com/issue-tracking/collections/{COLLECTION_ID}/tickets/277'
resp = requests.get(url, headers=HEADERS)
print('Status:', resp.status_code)
print('Body:', resp.text)
