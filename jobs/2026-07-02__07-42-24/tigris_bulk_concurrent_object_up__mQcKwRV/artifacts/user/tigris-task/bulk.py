import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

def main():
    # 1. Read run id and compute bucket name
    try:
        with open("/logs/artifacts/run-id", "r") as f:
            run_id = f.read().strip()
    except Exception as e:
        print(f"Error reading run-id: {e}")
        exit(1)

    bucket = f"harbor-bulk-{run_id}"
    bucket = re.sub(r"[^a-z0-9.-]", "-", bucket.lower())
    print(f"Using bucket: {bucket}")

    # 2. Build boto3 S3 client
    endpoint_url = os.environ.get("AWS_ENDPOINT_URL_S3", "https://t3.storage.dev")
    access_key_id = os.environ.get("TIGRIS_STORAGE_ACCESS_KEY_ID")
    secret_access_key = os.environ.get("TIGRIS_STORAGE_SECRET_ACCESS_KEY")

    if not access_key_id or not secret_access_key:
        print("Missing required environment variables TIGRIS_STORAGE_ACCESS_KEY_ID or TIGRIS_STORAGE_SECRET_ACCESS_KEY")
        exit(1)

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="auto",
        config=Config(s3={"addressing_style": "virtual"}),
    )

    # 3. Create the bucket
    try:
        client.create_bucket(Bucket=bucket)
        print(f"Bucket {bucket} created successfully.")
    except client.exceptions.BucketAlreadyOwnedByYou:
        print(f"Bucket {bucket} already owned by you.")
    except client.exceptions.BucketAlreadyExists:
        print(f"Bucket {bucket} already exists.")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code in ("BucketAlreadyExists", "BucketAlreadyOwnedByYou"):
            print(f"Bucket {bucket} already exists (handled via ClientError: {error_code}).")
        else:
            print(f"ClientError creating bucket: {e}")
            raise e
    except Exception as e:
        print(f"Unexpected error creating bucket: {e}")
        raise e

    # 4. Upload exactly 20 JSON objects in parallel
    def upload(n):
        n_str = format(n, "03d")
        key = f"events/event-{n_str}.json"
        body_dict = {"id": n_str, "ts": "2024-01-01"}
        body_bytes = json.dumps(body_dict).encode("utf-8")
        client.put_object(Bucket=bucket, Key=key, Body=body_bytes)
        print(f"Uploaded {key}")

    print("Starting concurrent uploads...")
    start_time = time.monotonic()
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        # We use list() to force evaluation and raise any exceptions that occurred during upload
        list(executor.map(upload, range(1, 21)))

    end_time = time.monotonic()
    duration_ms = max(1, int((end_time - start_time) * 1000))
    print(f"Upload completed in {duration_ms} ms.")

    # 5. Write the measurement to timing.txt
    timing_file_path = "/home/user/tigris-task/timing.txt"
    try:
        os.makedirs(os.path.dirname(timing_file_path), exist_ok=True)
        with open(timing_file_path, "w") as f:
            f.write(str(duration_ms))
        print(f"Timing written to {timing_file_path}")
    except Exception as e:
        print(f"Error writing timing file: {e}")
        exit(1)

if __name__ == "__main__":
    main()
