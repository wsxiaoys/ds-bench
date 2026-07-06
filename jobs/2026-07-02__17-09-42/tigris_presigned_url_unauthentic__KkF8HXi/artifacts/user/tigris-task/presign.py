#!/usr/bin/env python3
"""Mint a Tigris SigV4 presigned URL for share/secret.txt and download it unauthenticated."""
import os
import re
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

RUN_ID_PATH = "/logs/artifacts/run-id"
PRESIGN_PATH = "/home/user/tigris-task/presigned.url"
OBJECT_KEY = "share/secret.txt"
OBJECT_BODY = b"shareable content"  # exactly 17 bytes
EXPIRES_IN = 300


def normalize_bucket_name(name: str) -> str:
    """Lowercase and replace any invalid S3 chars with hyphens."""
    name = name.lower()
    # S3 bucket names: lowercase letters, numbers, dots, hyphens. Replace others with '-'.
    name = re.sub(r"[^a-z0-9.\-]", "-", name)
    return name


def main() -> None:
    with open(RUN_ID_PATH, "r") as f:
        run_id = f.read().strip()
    raw_bucket = f"harbor-presign-{run_id}"
    bucket = normalize_bucket_name(raw_bucket)

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["AWS_ENDPOINT_URL_S3"],
        region_name=os.environ["AWS_REGION"],
        config=Config(s3={"addressing_style": "virtual"}),
    )

    # 1. Create bucket (idempotent: treat BucketAlreadyOwnedByYou as success).
    try:
        s3.create_bucket(Bucket=bucket)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code != "BucketAlreadyOwnedByYou":
            raise

    # 2. Upload the secret object.
    s3.put_object(Bucket=bucket, Key=OBJECT_KEY, Body=OBJECT_BODY)

    # 3. Mint the presigned URL.
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": OBJECT_KEY},
        ExpiresIn=EXPIRES_IN,
    )

    # 4. Write URL to file (no trailing newline).
    with open(PRESIGN_PATH, "w", newline="") as f:
        f.write(url)

    print(f"Bucket: {bucket}")
    print(f"Presigned URL written to {PRESIGN_PATH}")


if __name__ == "__main__":
    main()
