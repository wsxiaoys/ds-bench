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
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

# Verify folder is in the root
resp = get('https://unify.apideck.com/file-storage/folders?drive_id=3ADA079B78534FF1')
folders = [f for f in resp.get('data', []) if 'zront29fiu' in f.get('name','')]
print('Folders in drive:')
for f in folders:
    print(' ', f.get('id'), f.get('name'))
