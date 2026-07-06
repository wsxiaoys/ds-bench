import os
import re
import boto3
from botocore.config import Config

# Read run_id
with open("/logs/artifacts/run-id", "r") as f:
    run_id = f.read().strip()

# Build bucket name
bucket_raw = f"harbor-presign-{run_id}".lower()
# Replace invalid characters (not a-z, 0-9, dot, or hyphen) with hyphens
bucket_name = re.sub(r'[^a-z0-9.-]', '-', bucket_raw)

# S3 Client targeting AWS_ENDPOINT_URL_S3
endpoint_url = os.environ.get("AWS_ENDPOINT_URL_S3", "https://t3.storage.dev")
region_name = os.environ.get("AWS_REGION", "auto")

config = Config(s3={"addressing_style": "virtual"})
s3_client = boto3.client(
    "s3",
    endpoint_url=endpoint_url,
    region_name=region_name,
    config=config
)

# Create bucket (catch BucketAlreadyOwnedByYou or BucketAlreadyExists)
try:
    s3_client.create_bucket(Bucket=bucket_name)
    print(f"Created bucket: {bucket_name}")
except Exception as e:
    err_str = str(e)
    if "BucketAlreadyOwnedByYou" in err_str or "BucketAlreadyExists" in err_str:
        print(f"Bucket already exists/owned: {bucket_name}")
    else:
        raise e

# Upload object share/secret.txt with body "shareable content"
s3_client.put_object(
    Bucket=bucket_name,
    Key="share/secret.txt",
    Body=b"shareable content"
)
print("Uploaded share/secret.txt")

# Generate presigned URL valid for 300 seconds
presigned_url = s3_client.generate_presigned_url(
    "get_object",
    Params={"Bucket": bucket_name, "Key": "share/secret.txt"},
    ExpiresIn=300
)
print(f"Generated presigned URL: {presigned_url}")

# Write to /home/user/tigris-task/presigned.url with no trailing newline
with open("/home/user/tigris-task/presigned.url", "w") as f:
    f.write(presigned_url)
print("Wrote presigned URL to /home/user/tigris-task/presigned.url")
