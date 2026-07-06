import os, json, urllib.request

api_key = os.environ['APIDECK_API_KEY']
app_id = os.environ['APIDECK_APP_ID']
consumer_id = os.environ['APIDECK_CONSUMER_ID']
drive_name = os.environ['APIDECK_FILE_STORAGE_DRIVE_NAME']

url = 'https://unify.apideck.com/file-storage/drives'
req = urllib.request.Request(url)
req.add_header('Authorization', f'Bearer {api_key}')
req.add_header('x-apideck-app-id', app_id)
req.add_header('x-apideck-consumer-id', consumer_id)
req.add_header('x-apideck-service-id', 'onedrive')

try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        print(body[:3000])
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code, e.read().decode())
