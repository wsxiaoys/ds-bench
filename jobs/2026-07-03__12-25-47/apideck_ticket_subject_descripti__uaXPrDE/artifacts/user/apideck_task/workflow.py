import os
import sys
import json
import requests

API_KEY = os.environ['APIDECK_API_KEY']
APP_ID = os.environ['APIDECK_APP_ID']
CONSUMER_ID = os.environ['APIDECK_CONSUMER_ID']
COLLECTION_ID = os.environ['APIDECK_ISSUE_TRACKING_COLLECTION_ID']
SERVICE_ID = 'github'

with open('/logs/artifacts/run-id', 'r') as f:
    run_id = f.read().strip()

BASE_URL = 'https://unify.apideck.com'
HEADERS = {
    'Authorization': f'Bearer {API_KEY}',
    'x-apideck-app-id': APP_ID,
    'x-apideck-consumer-id': CONSUMER_ID,
    'x-apideck-service-id': SERVICE_ID,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}

LOG_FILE = '/home/user/apideck_task/output.log'

def log(msg):
    print(msg)
    with open(LOG_FILE, 'a') as f:
        f.write(msg + '\n')

def get_existing_ticket_v1():
    """Look through the collection for an existing ticket containing [UPDATE-V1] for our run_id."""
    list_url = f'{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets'
    cursor = None
    marker = f'[UPDATE-V1] {run_id}'
    while True:
        params = {'limit': 100}
        if cursor:
            params['cursor'] = cursor
        resp = requests.get(list_url, headers=HEADERS, params=params)
        if resp.status_code not in (200, 201):
            return None
        data = resp.json()
        for t in data.get('data', []):
            subj = t.get('subject', '') or ''
            if marker in subj:
                return t.get('id')
        cursors = data.get('meta', {}).get('cursors', {}) or {}
        cursor = cursors.get('next')
        if not cursor:
            return None

ticket_id = get_existing_ticket_v1()

if ticket_id is None:
    # Create ticket
    create_url = f'{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets'
    initial_subject = f'[UPDATE-V1] {run_id}'
    initial_body = {
        'subject': initial_subject,
        'description': f'Initial ticket for run {run_id}',
    }

    log(f'Creating ticket with subject: {initial_subject}')
    resp = requests.post(create_url, headers=HEADERS, json=initial_body)
    log(f'Create status: {resp.status_code}')
    log(f'Create response: {resp.text}')

    if resp.status_code not in (200, 201):
        sys.exit(f'Failed to create ticket: {resp.status_code} {resp.text}')

    data = resp.json()
    ticket = data.get('data', {})
    ticket_id = ticket.get('id')
    log(f'Ticket ID: {ticket_id}')
else:
    log(f'Found existing ticket: {ticket_id}')

# Update ticket
update_url = f'{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}'
new_subject = f'[UPDATE-V2] {run_id}'
update_body = {
    'subject': new_subject,
    'description': 'Revised draft v2',
}

log(f'Updating ticket with subject: {new_subject}')
resp = requests.patch(update_url, headers=HEADERS, json=update_body)
log(f'Update status: {resp.status_code}')
log(f'Update response: {resp.text}')

if resp.status_code not in (200, 201):
    sys.exit(f'Failed to update ticket: {resp.status_code} {resp.text}')

log(f'Ticket ID: {ticket_id}')
log('Workflow complete')
