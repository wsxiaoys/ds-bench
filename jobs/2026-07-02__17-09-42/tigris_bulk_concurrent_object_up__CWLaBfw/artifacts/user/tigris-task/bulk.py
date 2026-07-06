import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

import boto3
from botocore.client import Config


def main() -> None:
    run_id = open("/logs/artifacts/run-id").read().strip()
    bucket = f"harbor-bulk-{run_id}"
    bucket = re.sub(r"[^a-z0-9.-]", "-", bucket.lower())

    client = boto3.client(
        "s3",
        endpoint_url=os.environ.get("AWS_ENDPOINT_URL_S3", "REDACTED"),
        aws_access_key_id=os.environ["TIGRIS_STORAGE_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["TIGRIS_STORAGE_SECRET_ACCESS_KEY"],
        region_name="REDACTED",
        config=Config(s3={"addressing_style": "virtual"}),
    )

    try:
        client.create_bucket(Bucket=bucket)
    except client.exceptions.BucketAlreadyOwnedByYou:
        pass
    except client.exceptions.BucketAlreadyExists:
        pass

    def upload(n: int) -> None:
        n_str = format(n, "03d")
        body = json.dumps({"id": n_str, "ts": "2024-01-01"}).encode("utf-8")
        client.put_object(
            Bucket=bucket,
            Key=f"events/event-{n_str}.json",
            Body=body,
        )

    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(upload, range(1, 21)))
    duration_ms = max(1, int((time.monotonic() - start) * 1000))

    with open("/home/user/tigris-task/timing.txt", "w") as f:
        f.write(str(duration_ms))


if __name__ == "__main__":
    main()