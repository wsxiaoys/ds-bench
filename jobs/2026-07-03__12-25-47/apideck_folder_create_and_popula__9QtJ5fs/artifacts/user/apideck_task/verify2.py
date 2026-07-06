import os, json, urllib.request

api_key = os.environ['APIDECK_API_KEY']
app_id = os.environ['APIDECK_APP_ID']
consumer_id = os.environ['APIDECK_CONSUMER_ID']

def get(url):
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {api_key}')
    req.add_header('x-apideck-app-id', app_id)
    req.add_header('x-apideck-consumer-id', consumer_id)
    req.add_header('x-apideck-service-id', 'onedrive')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or 'null')

import urllib.error
d = json.load(open('/home/user/apideck_task/output.log'))
folder_id = d['folder_id']

# Try listing files in folder
urls = [
    f'https://unify.apideck.com/file-storage/files?folder_id={folder_id}',
    f'https://unify.apideck.com/file-storage/files?parent_folder_id={folder_id}',
    f'https://unify.apideck.com/file-storage/folders/{folder_id}/files',
]
for u in urls:
    print('GET', u)
    s, r = get(u)
    print(' ->', s, json.dumps(r)[:400])
