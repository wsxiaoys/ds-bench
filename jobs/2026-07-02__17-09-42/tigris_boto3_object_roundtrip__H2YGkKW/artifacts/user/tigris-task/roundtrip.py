import json
import os
import pathlib
import re

import boto3
from botocore.client import Config


def main() -> None:
    run_id = pathlib.Path("/logs/artifacts/run-id").read_text().strip()
    bucket = f"harbor-boto3-{run_id}"
    # S3 bucket names can only contain lowercase letters, numbers, dots, and hyphens.
    # Normalize to lowercase and replace any invalid characters (e.g. underscores) with hyphens.
    bucket = re.sub(r"[^a-z0-9.-]", "-", bucket.lower())

    key = "data/payload.json"
    payload = b'{"hello":"tigris"}'

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["AWS_ENDPOINT_URL_S3"],
        config=Config(s3={"addressing_style": "virtual"}),
    )

    try:
        s3.create_bucket(Bucket=bucket)
    except s3.exceptions.BucketAlreadyOwnedByYou:
        pass

    s3.put_object(Bucket=bucket, Key=key, Body=payload)

    downloaded = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
    pathlib.Path("/home/user/tigris-task/downloaded.json").write_bytes(downloaded)


if __name__ == "__main__":
    main()
