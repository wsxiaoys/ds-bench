import os, json, urllib.request, urllib.error

api_key = os.environ['APIDECK_API_KEY']
app_id = os.environ['APIDECK_APP_ID']
consumer_id = os.environ['APIDECK_CONSUMER_ID']
drive_name = os.environ['APIDECK_FILE_STORAGE_DRIVE_NAME']
run_id = open('/logs/artifacts/run-id').read().strip()

BASE = 'https://unify.apideck.com'
UPLOAD = 'https://upload.apideck.com'

def headers(json_body=True):
    h = {
        'Authorization': f'Bearer {api_key}',
        'x-apideck-app-id': app_id,
        'x-apideck-consumer-id': consumer_id,
        'x-apideck-service-id': 'onedrive',
    }
    if json_body:
        h['Content-Type'] = 'application/json'
    return h

def http(method, url, body=None, extra_headers=None):
    data = None
    if body is not None:
        if isinstance(body, str):
            data = body.encode('utf-8')
        else:
            data = body
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in headers(isinstance(body, str)).items():
        req.add_header(k, v)
    if extra_headers:
        for k, v in extra_headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or 'null')

# 1. List drives and find REDACTED drive id
status, resp = http('GET', f'{BASE}/file-storage/drives')
print('Drives:', status)
drive_id = None
for d in resp.get('data', []):
    print(' drive:', d.get('id'), '->', d.get('name'))
    if d.get('name') == drive_name:
        drive_id = d['id']
print('Selected drive_id:', drive_id)
assert drive_id is not None, 'No drive found'

# 2. Create folder
folder_name = f'FOLDER-{run_id}'
folder_body = json.dumps({
    'name': folder_name,
    'parent_folder_id': 'root',
    'drive_id': drive_id,
})
status, resp = http('POST', f'{BASE}/file-storage/folders', folder_body)
print('Create folder:', status, json.dumps(resp)[:500])
assert status in (200, 201), f'Folder create failed: {resp}'
folder_id = resp['data']['id']
print('folder_id:', folder_id)

# 3. Upload 3 files
file_ids = []
for i in (1, 2, 3):
    fname = f'NOTE-{run_id}-{i}.txt'
    payload = f'Run-scoped note {i} for {run_id}\n'.encode('utf-8')
    meta = json.dumps({
        'name': fname,
        'parent_folder_id': folder_id,
        'drive_id': drive_id,
    })
    extra = {'x-apideck-metadata': meta, 'Content-Type': 'application/octet-stream'}
    status, resp = http('POST', f'{UPLOAD}/file-storage/files', payload, extra)
    print(f'Upload {fname}:', status, json.dumps(resp)[:300])
    assert status in (200, 201), f'File upload failed: {resp}'
    file_ids.append(resp['data']['id'])

# 4. Write output log
log_line = json.dumps({'folder_id': folder_id, 'file_ids': file_ids})
with open('/home/user/apideck_task/output.log', 'w') as f:
    f.write(log_line + '\n')
print('LOG:', log_line)
print('DONE')
