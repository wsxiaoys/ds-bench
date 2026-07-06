#!/usr/bin/env python3
import os
import json
import requests
import sys

APP_ID = os.environ['APIDECK_APP_ID']
API_KEY = os.environ['APIDECK_API_KEY']
CONSUMER_ID = os.environ['APIDECK_CONSUMER_ID']
DRIVE_NAME = os.environ['APIDECK_FILE_STORAGE_DRIVE_NAME']
SERVICE_ID = 'onedrive'

with open('/logs/artifacts/run-id', 'r') as f:
    RUN_ID = f.read().strip()

PREFIX = f'AGG-{RUN_ID}-'
UPLOAD_BASE = 'https://upload.apideck.com'
UNIFY_BASE = 'https://unify.apideck.com'

OUTPUT_LOG = '/home/user/apideck_task/output.log'

HEADERS = {
    'Authorization': f'Bearer {API_KEY}',
    'x-apideck-app-id': APP_ID,
    'x-apideck-consumer-id': CONSUMER_ID,
    'x-apideck-service-id': SERVICE_ID,
}

def log(msg):
    print(msg, file=sys.stderr)

# 1) Upload 7 files
for i in range(1, 8):
    name = f'{PREFIX}{i}.txt'
    url = f'{UPLOAD_BASE}/file-storage/files'
    meta = {
        'name': name,
        'parent_folder_id': 'root',
    }
    headers = dict(HEADERS)
    headers['x-apideck-metadata'] = json.dumps(meta)
    log(f'Uploading {name}...')
    r = requests.post(
        url,
        headers=headers,
        files={'file': (name, f'file {i} content for {RUN_ID}\n', 'text/plain')},
        timeout=60,
    )
    log(f'  status={r.status_code} body={r.text[:300]}')
    if r.status_code >= 400:
        sys.exit(f'Upload of {name} failed')

# 2) Cursor pagination
ids = []
seen = set()
cursor = None
page = 0
while True:
    page += 1
    params = {'limit': 3}
    if cursor:
        params['cursor'] = cursor
    url = f'{UNIFY_BASE}/file-storage/files'
    log(f'Listing page {page} cursor={cursor}')
    r = requests.get(url, headers=HEADERS, params=params, timeout=60)
    log(f'  status={r.status_code}')
    if r.status_code >= 400:
        log(f'  body={r.text[:500]}')
        sys.exit('List failed')
    data = r.json()
    files = data.get('data', [])
    for f in files:
        name = f.get('name') or ''
        fid = f.get('id')
        if name.startswith(PREFIX) and fid and fid not in seen:
            seen.add(fid)
            ids.append(fid)
    meta = data.get('meta', {}) or {}
    cursors = meta.get('cursors', {}) or {}
    cursor = cursors.get('next') or ''
    log(f'  found {len(files)} files on page, next cursor={cursor!r}')
    if not cursor:
        break

summary = {
    'count': len(ids),
    'ids': ids,
}

with open(OUTPUT_LOG, 'w') as f:
    f.write(json.dumps(summary))

log(f'Wrote summary: {summary}')
