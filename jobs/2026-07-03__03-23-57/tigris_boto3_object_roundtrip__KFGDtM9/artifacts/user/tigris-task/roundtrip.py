import json
import os
import pathlib
import re
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

def main():
    run_id = pathlib.Path("/logs/artifacts/run-id").read_text().strip()
    bucket = f"harbor-boto3-{run_id}"
    bucket = re.sub(r"[^a-z0-9.-]", "-", bucket.lower())
    key = "data/payload.json"
    payload = b'{"hello":"tigris"}'

    endpoint_url = os.environ.get("AWS_ENDPOINT_URL_S3")
    if not endpoint_url:
        raise ValueError("AWS_ENDPOINT_URL_S3 environment variable is not set")

    print(f"Connecting to S3 endpoint: {endpoint_url}")
    print(f"Target bucket: {bucket}")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        config=Config(s3={"addressing_style": "virtual"}),
    )

    try:
        s3.create_bucket(Bucket=bucket)
        print(f"Successfully created bucket: {bucket}")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            print(f"Bucket {bucket} already exists (idempotent success).")
        else:
            raise e

    print(f"Uploading payload to key: {key}")
    s3.put_object(Bucket=bucket, Key=key, Body=payload)

    print("Downloading payload back into memory...")
    response = s3.get_object(Bucket=bucket, Key=key)
    downloaded = response["Body"].read()

    output_path = pathlib.Path("/home/user/tigris-task/downloaded.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(downloaded)
    print(f"Successfully wrote downloaded bytes to {output_path}")

if __name__ == "__main__":
    main()
