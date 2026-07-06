#!/usr/bin/env python3
"""Full object roundtrip against Tigris using boto3."""

import os
import pathlib
import re

import boto3
from botocore.client import Config


def main() -> None:
    # 1. Read the run identifier and derive the bucket name.
    run_id = pathlib.Path("/logs/artifacts/run-id").read_text().strip()
    bucket = f"harbor-boto3-{run_id}"

    # S3 bucket names can only contain lowercase letters, numbers, dots, and
    # hyphens. Normalize by lowercasing and replacing any invalid characters
    # (such as underscores) with hyphens.
    bucket = re.sub(r"[^a-z0-9.-]", "-", bucket.lower())

    key = "data/payload.json"
    # Exactly these 18 bytes — no extra whitespace, no trailing newline.
    payload = b'{"hello":"tigris"}'

    # 2. Create a boto3 S3 client pointed at the Tigris endpoint. Credentials
    #    and region are picked up REDACTEDmatically from the AWS_* environment
    #    variables that the Harbor runtime injects.
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["AWS_ENDPOINT_URL_S3"],
        config=Config(s3={"addressing_style": "virtual"}),
    )

    # 3. Create the bucket idempotently. If it already exists and is owned by
    #    the caller, treat that as success.
    try:
        s3.create_bucket(Bucket=bucket)
    except s3.exceptions.BucketAlreadyOwnedByYou:
        pass

    # 4. Upload the JSON payload under the object key.
    s3.put_object(Bucket=bucket, Key=key, Body=payload)

    # 5. Download the object back into memory and write the bytes verbatim to
    #    the local artifact file.
    downloaded = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
    out_path = pathlib.Path("/home/user/tigris-task/downloaded.json")
    out_path.write_bytes(downloaded)

    # Sanity check: the downloaded bytes must match what we uploaded.
    assert downloaded == payload, (
        f"roundtrip mismatch: uploaded {payload!r} but downloaded {downloaded!r}"
    )

    print(
        f"Roundtrip OK: bucket={bucket!r} key={key!r} "
        f"bytes={len(downloaded)} -> {out_path}"
    )


if __name__ == "__main__":
    main()