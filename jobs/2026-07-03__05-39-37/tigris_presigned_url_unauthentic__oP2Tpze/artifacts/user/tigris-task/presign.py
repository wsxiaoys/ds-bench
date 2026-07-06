#!/usr/bin/env python3
"""Mint an S3 SigV4 presigned URL for a Tigris object and write it to disk."""

import os
import re
import sys

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

RUN_ID_PATH = "/logs/artifacts/run-id"
PRESIGNED_URL_PATH = "/home/user/tigris-task/presigned.url"
OBJECT_KEY = "share/secret.txt"
OBJECT_BODY = b"shareable content"  # exactly 17 bytes, no newline


def normalize_bucket_name(name: str) -> str:
    """Lowercase and replace any char that is not [a-z0-9.-] with a hyphen."""
    name = name.lower()
    return re.sub(r"[^a-z0-9.-]", "-", name)


def main() -> int:
    with open(RUN_ID_PATH, "r") as fh:
        run_id = fh.read().strip()

    bucket = normalize_bucket_name(f"harbor-presign-{run_id}")
    print(f"run_id={run_id!r} bucket={bucket!r}")

    endpoint = os.environ.get("AWS_ENDPOINT_URL_S3", "REDACTED")
    region = os.environ.get("AWS_REGION", "REDACTED")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        config=Config(s3={"addressing_style": "virtual"}),
    )

    # Step 2: create bucket (idempotent)
    try:
        s3.create_bucket(Bucket=bucket)
        print(f"created bucket {bucket}")
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "BucketAlreadyOwnedByYou":
            print(f"bucket {bucket} already owned by us - treating as success")
        else:
            raise

    # Step 3: upload object
    s3.put_object(Bucket=bucket, Key=OBJECT_KEY, Body=OBJECT_BODY)
    print(f"uploaded {OBJECT_KEY} ({len(OBJECT_BODY)} bytes)")

    # Step 4: generate presigned URL
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": OBJECT_KEY},
        ExpiresIn=300,
    )

    # Step 5: write URL with no trailing newline
    with open(PRESIGNED_URL_PATH, "w") as fh:
        fh.write(url)
    print(f"wrote presigned URL to {PRESIGNED_URL_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())