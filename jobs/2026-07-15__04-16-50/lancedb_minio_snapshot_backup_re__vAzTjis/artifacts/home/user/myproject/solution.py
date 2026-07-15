import os
import shutil
import tempfile
import boto3
from urllib.parse import urlparse

def parse_s3_uri(s3_uri: str):
    if not s3_uri.startswith("s3://"):
        raise ValueError("Invalid S3 URI. Must start with 's3://'")
    parsed = urlparse(s3_uri)
    bucket = parsed.netloc
    prefix = parsed.path.lstrip('/')
    return bucket, prefix

def get_s3_client():
    endpoint_url = os.environ.get("AWS_ENDPOINT_URL")
    access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    region_name = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region_name,
    )

def clear_s3_prefix(s3_client, bucket: str, prefix: str) -> None:
    if not prefix:
        return
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
    
    delete_us = []
    for page in pages:
        if 'Contents' in page:
            for obj in page['Contents']:
                key = obj['Key']
                if key == prefix or key.startswith(prefix + '/'):
                    delete_us.append({'Key': key})
                    
    for i in range(0, len(delete_us), 1000):
        batch = delete_us[i:i+1000]
        s3_client.delete_objects(Bucket=bucket, Delete={'Objects': batch})

def backup(local_table_path: str, s3_uri: str) -> None:
    if not os.path.exists(local_table_path):
        raise FileNotFoundError(f"Local table path {local_table_path} does not exist.")
    if not os.path.isdir(local_table_path):
        raise ValueError(f"Local table path {local_table_path} is not a directory.")
        
    bucket, prefix = parse_s3_uri(s3_uri)
    s3_client = get_s3_client()
    
    # Clean up existing files under the prefix to ensure clean snapshot
    clear_s3_prefix(s3_client, bucket, prefix)
    
    for root, dirs, files in os.walk(local_table_path):
        for file in files:
            local_file_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_file_path, local_table_path)
            relative_path_posix = relative_path.replace(os.sep, '/')
            
            if prefix:
                key = f"{prefix}/{relative_path_posix}" if not prefix.endswith('/') else f"{prefix}{relative_path_posix}"
            else:
                key = relative_path_posix
                
            s3_client.upload_file(local_file_path, bucket, key)

def restore(s3_uri: str, new_local_table_path: str) -> None:
    bucket, prefix = parse_s3_uri(s3_uri)
    s3_client = get_s3_client()
    
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
    
    objects_to_download = []
    prefix_dir = prefix if (not prefix or prefix.endswith('/')) else prefix + '/'
    
    for page in pages:
        if 'Contents' in page:
            for obj in page['Contents']:
                key = obj['Key']
                if prefix:
                    if key.startswith(prefix_dir):
                        relative_path = key[len(prefix_dir):]
                        if relative_path:
                            objects_to_download.append((key, relative_path))
                else:
                    objects_to_download.append((key, key))
                    
    if not objects_to_download:
        raise FileNotFoundError(f"No backup found at S3 URI: {s3_uri}")
        
    parent_dir = os.path.dirname(os.path.abspath(new_local_table_path))
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)
        
    temp_dir = tempfile.mkdtemp(dir=parent_dir)
    try:
        for key, relative_path in objects_to_download:
            dest_file_path = os.path.join(temp_dir, relative_path)
            os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
            s3_client.download_file(bucket, key, dest_file_path)
            
        if os.path.exists(new_local_table_path):
            if os.path.isdir(new_local_table_path):
                shutil.rmtree(new_local_table_path)
            else:
                os.remove(new_local_table_path)
                
        shutil.move(temp_dir, new_local_table_path)
        
    except Exception as e:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        raise e
