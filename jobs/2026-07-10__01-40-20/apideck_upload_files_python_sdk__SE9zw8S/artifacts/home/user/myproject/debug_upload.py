#!/usr/bin/env python3
import os
import json
from apideck_unify import Apideck

api_key = os.environ["APIDECK_API_KEY"]
app_id = os.environ["APIDECK_APP_ID"]
consumer_id = os.environ["APIDECK_CONSUMER_ID"]
drive_name = os.environ["APIDECK_FILE_STORAGE_DRIVE_NAME"]
service_id = "onedrive"

with open("/logs/artifacts/run-id") as fh:
    run_id = fh.read().strip()

client = Apideck(api_key=api_key, consumer_id=consumer_id, app_id=app_id)

resp = client.file_storage.drives.list(service_id=service_id, limit=200)
drive_id = None
for d in resp.get_drives_response.data:
    if d.name == drive_name:
        drive_id = d.id
print("drive_id =", drive_id)

name = f"report-{run_id}-debug.txt"
content = f"debug payload for {run_id}\n".encode("utf-8")

create = client.file_storage.upload_sessions.create(
    name=name, parent_folder_id="root", size=len(content),
    drive_id=drive_id, service_id=service_id,
)
sid = create.create_upload_session_response.data.id
print("session id (first 60) =", sid[:60])

def dump_err(label, e):
    print(f"--- {label}: {type(e).__name__} ---")
    data = getattr(e, "data", None)
    if data is not None:
        try:
            print(json.dumps(data.model_dump(mode="json"), indent=2)[:5000])
        except Exception:
            print("raw data:", repr(data)[:3000])
    else:
        print("repr:", repr(e)[:3000])

# Try GET
try:
    sess = client.file_storage.upload_sessions.get(id=sid, service_id=service_id)
    print("GET OK:", sess.get_upload_session_response.data.model_dump(mode="json"))
except Exception as e:
    dump_err("GET", e)

# Try upload with part_number 0
try:
    up = client.file_storage.upload_sessions.upload(
        id=sid, part_number=0, request_body=content, service_id=service_id,
    )
    print("UPLOAD(0) OK ->", up.update_upload_session_response.data.id)
except Exception as e:
    dump_err("UPLOAD(0)", e)