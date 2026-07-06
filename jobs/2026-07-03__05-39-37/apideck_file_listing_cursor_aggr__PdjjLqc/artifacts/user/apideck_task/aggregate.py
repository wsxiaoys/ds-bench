#!/usr/bin/env python3
"""
Aggregate Files With Cursor Pagination (Apideck File Storage).

This script:
  1. Reads Apideck credentials and the run-id from the environment / artifacts.
  2. Resolves the REDACTED drive named in APIDECK_FILE_STORAGE_DRIVE_NAME.
  3. Uploads 7 small text files (AGG-<run-id>-1.txt .. AGG-<run-id>-7.txt) to the
     drive root via the upload host.
  4. Walks the file listing on the unify host using cursor pagination (limit=3),
     aggregating every file whose name starts with the run-scoped prefix.
  5. Emits a single JSON summary {"count": 7, "ids": [...]} to output.log.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UPLOAD_HOST = "https://upload.apideck.com"
UNIFY_HOST = "https://unify.apideck.com"
SERVICE_ID = "onedrive"
NUM_FILES = 7
PAGE_LIMIT = 3
RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_LOG = "/home/user/apideck_task/output.log"

# How many times to re-walk pagination looking for all uploaded files before
# giving up. Handles minor eventual-consistency delays on the connector side.
MAX_WALK_ATTEMPTS = 5
WALK_RETRY_DELAY = 3  # seconds

# HTTP retry configuration for transient failures.
HTTP_MAX_RETRIES = 4
HTTP_BACKOFF_BASE = 1.5  # seconds


def die(msg):
    sys.stderr.write("ERROR: %s\n" % msg)
    sys.exit(1)


def get_env(name):
    value = os.environ.get(name)
    if not value:
        die("Missing required environment variable: %s" % name)
    return value


def read_run_id():
    try:
        with open(RUN_ID_PATH, "r") as fh:
            run_id = fh.read().strip()
    except OSError as exc:
        die("Unable to read run-id from %s: %s" % (RUN_ID_PATH, exc))
    if not run_id:
        die("Run-id file %s is empty" % RUN_ID_PATH)
    return run_id


def http_request(method, url, headers=None, body=None, timeout=60):
    """Perform an HTTP request with simple exponential backoff on transient errors."""
    headers = headers or {}
    last_exc = None
    for attempt in range(HTTP_MAX_RETRIES):
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                status = resp.getcode()
                ctype = resp.headers.get("Content-Type", "")
                return status, raw, ctype
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            # Retry on rate limit / server errors; otherwise surface immediately.
            if exc.code in (429, 500, 502, 503, 504) and attempt < HTTP_MAX_RETRIES - 1:
                last_exc = exc
                time.sleep(HTTP_BACKOFF_BASE ** (attempt + 1))
                continue
            return exc.code, raw, exc.headers.get("Content-Type", "")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_exc = exc
            if attempt < HTTP_MAX_RETRIES - 1:
                time.sleep(HTTP_BACKOFF_BASE ** (attempt + 1))
                continue
            raise
    raise RuntimeError("HTTP request failed after retries: %s" % last_exc)


def parse_json(status, raw, ctype):
    if status >= 400:
        snippet = raw[:500].decode("utf-8", "replace")
        die("HTTP %d response: %s" % (status, snippet))
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError as exc:
        die("Failed to parse JSON response: %s; body=%s" % (exc, raw[:500]))


def common_headers(api_key, app_id, consumer_id):
    return {
        "Authorization": "Bearer %s" % api_key,
        "x-apideck-app-id": app_id,
        "x-apideck-consumer-id": consumer_id,
        "x-apideck-service-id": SERVICE_ID,
    }


def resolve_drive(api_key, app_id, consumer_id, drive_name):
    """List drives (with cursor pagination) and return the id of the named drive."""
    headers = common_headers(api_key, app_id, consumer_id)
    cursor = None
    seen = set()
    while True:
        params = {"limit": "200"}
        if cursor:
            params["cursor"] = cursor
        url = "%s/file-storage/drives?%s" % (
            UNIFY_HOST,
            urllib.parse.urlencode(params),
        )
        status, raw, ctype = http_request("GET", url, headers=headers)
        payload = parse_json(status, raw, ctype)
        for drive in payload.get("data", []) or []:
            did = drive.get("id")
            dname = drive.get("name")
            if dname == drive_name and did:
                return did
            if did:
                seen.add((did, dname))
        cursor = (payload.get("meta") or {}).get("cursors", {}).get("next")
        if not cursor:
            break
    die(
        "Drive named %r not found. Available drives: %s"
        % (drive_name, ", ".join("%s=%s" % (n, i) for i, n in seen) or "<none>")
    )


def upload_file(api_key, app_id, consumer_id, drive_id, filename, content):
    """Upload a single file to the drive root via the upload host."""
    headers = common_headers(api_key, app_id, consumer_id)
    headers["Content-Type"] = "text/plain"
    metadata = {
        "name": filename,
        "parent_folder_id": "root",
        "drive_id": drive_id,
    }
    headers["x-apideck-metadata"] = json.dumps(metadata, separators=(",", ":"))
    url = "%s/file-storage/files" % UPLOAD_HOST
    status, raw, ctype = http_request(
        "POST", url, headers=headers, body=content
    )
    payload = parse_json(status, raw, ctype)
    file_id = (payload.get("data") or {}).get("id")
    if not file_id:
        die("Upload of %s succeeded (HTTP %d) but no file id returned: %s"
            % (filename, status, raw[:500]))
    return file_id


def list_files_page(api_key, app_id, consumer_id, cursor):
    """Fetch one page of files (limit=PAGE_LIMIT). Returns (files, next_cursor)."""
    headers = common_headers(api_key, app_id, consumer_id)
    params = {"limit": str(PAGE_LIMIT)}
    if cursor:
        params["cursor"] = cursor
    url = "%s/file-storage/files?%s" % (
        UNIFY_HOST,
        urllib.parse.urlencode(params),
    )
    status, raw, ctype = http_request("GET", url, headers=headers)
    payload = parse_json(status, raw, ctype)
    files = payload.get("data", []) or []
    next_cursor = (payload.get("meta") or {}).get("cursors", {}).get("next")
    return files, next_cursor


def aggregate_files(api_key, app_id, consumer_id, prefix):
    """Walk all pages with cursor pagination and collect ids of files matching prefix."""
    collected = []
    seen_ids = set()
    cursor = None
    pages = 0
    while True:
        files, next_cursor = list_files_page(
            api_key, app_id, consumer_id, cursor
        )
        pages += 1
        for f in files:
            name = f.get("name") or ""
            fid = f.get("id")
            if name.startswith(prefix) and fid and fid not in seen_ids:
                seen_ids.add(fid)
                collected.append(fid)
        cursor = next_cursor
        if not cursor:
            break
    return collected, pages


def main():
    api_key = get_env("APIDECK_API_KEY")
    app_id = get_env("APIDECK_APP_ID")
    consumer_id = get_env("APIDECK_CONSUMER_ID")
    drive_name = get_env("APIDECK_FILE_STORAGE_DRIVE_NAME")
    run_id = read_run_id()

    prefix = "AGG-%s-" % run_id

    print("Run id:        %s" % run_id)
    print("Drive name:    %s" % drive_name)
    print("File prefix:   %s" % prefix)

    # 1. Resolve the target drive id.
    drive_id = resolve_drive(api_key, app_id, consumer_id, drive_name)
    print("Resolved drive id: %s" % drive_id)

    # 2. Upload the 7 files to the drive root.
    uploaded_ids = []
    for n in range(1, NUM_FILES + 1):
        filename = "AGG-%s-%d.txt" % (run_id, n)
        content = ("Aggregate file %d for run %s.\n" % (n, run_id)).encode("utf-8")
        fid = upload_file(api_key, app_id, consumer_id, drive_id, filename, content)
        uploaded_ids.append(fid)
        print("Uploaded %s -> %s" % (filename, fid))

    # 3. Walk the listing with cursor pagination and aggregate matching files.
    #    Retry the full walk a few times to tolerate propagation delays.
    ids = []
    for attempt in range(1, MAX_WALK_ATTEMPTS + 1):
        ids, pages = aggregate_files(api_key, app_id, consumer_id, prefix)
        print(
            "Walk attempt %d: %d matching files across %d page(s)."
            % (attempt, len(ids), pages)
        )
        if len(ids) >= NUM_FILES:
            break
        if attempt < MAX_WALK_ATTEMPTS:
            print("Not all files visible yet; retrying in %ds..." % WALK_RETRY_DELAY)
            time.sleep(WALK_RETRY_DELAY)

    # 4. Emit the JSON summary.
    summary = {"count": len(ids), "ids": ids}
    with open(OUTPUT_LOG, "w") as fh:
        fh.write(json.dumps(summary, separators=(",", ":")) + "\n")

    print("Summary written to %s: %s" % (OUTPUT_LOG, json.dumps(summary)))

    if len(ids) != NUM_FILES:
        die(
            "Aggregation did not find exactly %d files (found %d)."
            % (NUM_FILES, len(ids))
        )


if __name__ == "__main__":
    main()