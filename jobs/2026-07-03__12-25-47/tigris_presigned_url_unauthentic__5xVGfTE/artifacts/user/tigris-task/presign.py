import os
import re
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

# Step 1: read run-id
with open('/logs/artifacts/run-id', 'r') as f:
    run_id = f.read().strip()

# Normalize: lowercase, replace invalid chars with hyphens
normalized = run_id.lower()
# S3 bucket names can contain lowercase letters, numbers, dots, and hyphens
normalized = re.sub(r'[^a-z0-9.\-]', '-', normalized)
bucket = f"harbor-presign-{normalized}"
print(f"Bucket name: {bucket}")

# Step 2: build boto3 S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=os.environ['AWS_ENDPOINT_URL_S3'],
    region_name=os.environ.get('AWS_REGION', 'REDACTED'),
    config=Config(s3={"addressing_style": "virtual"}),
)

# Step 3: create bucket (treat BucketAlreadyOwnedByYou as success)
try:
    s3_client.create_bucket(Bucket=bucket)
    print(f"Bucket {bucket} created")
except ClientError as e:
    code = e.response.get('Error', {}).get('Code')
    if code in ('BucketAlreadyOwnedByYou', 'BucketAlreadyExists'):
        print(f"Bucket {bucket} already owned/exists - continuing")
    else:
        raise

# Step 4: upload object
s3_client.put_object(Bucket=bucket, Key="share/secret.txt", Body=b"shareable content")
print("Object uploaded")

# Step 5: mint presigned URL
url = s3_client.generate_presigned_url(
    "get_object",
    Params={"Bucket": bucket, "Key": "share/secret.txt"},
    ExpiresIn=300,
)
print(f"Presigned URL length: {len(url)}")

# Step 6: write URL with no trailing newline
with open('/home/user/tigris-task/presigned.url', 'w') as f:
    f.write(url)
print("Wrote /home/user/tigris-task/presigned.url")
