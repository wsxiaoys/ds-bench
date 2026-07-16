"""
LanceDB point-in-time backup / restore to a MinIO (S3-compatible) object store.

backup(local_table_path, s3_uri)
    Recursively uploads every file inside the *.lance dataset directory to
    S3, preserving relative paths under the given prefix.  The copy is
    complete – all manifests, transaction files and data fragments are
    included – so every historical version remains restorable.

restore(s3_uri, new_local_table_path)
    Downloads all objects stored under the S3 prefix back onto the local
    filesystem, recreating the original directory tree.  Raises an exception
    (and cleans up any partial writes) when the prefix holds no backup.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _s3_client() -> "boto3.client":
    """Return a boto3 S3 client configured from environment variables."""
    return boto3.client(
        "s3",
        endpoint_url=os.environ["AWS_ENDPOINT_URL"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        # The endpoint uses plain HTTP; disable SSL verification complaints.
        use_ssl=False,
        verify=False,
    )


def _parse_s3_uri(s3_uri: str) -> tuple[str, str]:
    """Return *(bucket, prefix)* extracted from an ``s3://bucket/prefix`` URI."""
    parsed = urlparse(s3_uri)
    if parsed.scheme != "s3":
        raise ValueError(f"Expected an s3:// URI, got: {s3_uri!r}")
    bucket = parsed.netloc
    # Strip leading slash so the prefix never starts with '/'.
    prefix = parsed.path.lstrip("/")
    return bucket, prefix


def _list_remote_objects(client, bucket: str, prefix: str) -> list[str]:
    """Return all object keys under *prefix* (with trailing slash normalised)."""
    paginator = client.get_paginator("list_objects_v2")
    # Ensure the prefix ends with '/' so we don't accidentally match a
    # sibling that begins with the same characters.
    search_prefix = prefix if prefix.endswith("/") else prefix + "/"
    keys: list[str] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=search_prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def backup(local_table_path: str, s3_uri: str) -> None:
    """Upload the entire LanceDB dataset directory to *s3_uri*.

    Every file inside *local_table_path* (manifests, transaction files, data
    fragments, …) is copied to S3 as a separate object.  The object key is
    ``<prefix>/<relative-path-inside-dataset>``, which makes it possible to
    restore the exact directory layout later.

    Parameters
    ----------
    local_table_path:
        Absolute or relative path to a ``*.lance`` dataset directory on the
        local filesystem.
    s3_uri:
        Destination in the form ``s3://<bucket>/<prefix>``.
    """
    table_dir = Path(local_table_path).resolve()
    if not table_dir.is_dir():
        raise FileNotFoundError(
            f"LanceDB table directory does not exist: {table_dir}"
        )

    bucket, prefix = _parse_s3_uri(s3_uri)
    client = _s3_client()

    uploaded = 0
    for local_file in sorted(table_dir.rglob("*")):
        if not local_file.is_file():
            continue
        # Relative path inside the dataset directory.
        rel = local_file.relative_to(table_dir)
        # Object key: <prefix>/<relative-path>
        object_key = f"{prefix}/{rel.as_posix()}" if prefix else rel.as_posix()
        client.upload_file(str(local_file), bucket, object_key)
        uploaded += 1

    if uploaded == 0:
        raise RuntimeError(
            f"No files found inside {table_dir}; is this a valid LanceDB table?"
        )


def restore(s3_uri: str, new_local_table_path: str) -> None:
    """Download a previously backed-up LanceDB dataset from *s3_uri*.

    The original directory tree is reconstructed at *new_local_table_path*.
    After a successful restore the table can be opened with LanceDB and all
    historical versions are available.

    Raises ``FileNotFoundError`` when the S3 prefix contains no backup objects,
    and cleans up any partial writes so that no half-written dataset directory
    is left behind.

    Parameters
    ----------
    s3_uri:
        Location of the backup in the form ``s3://<bucket>/<prefix>``.
    new_local_table_path:
        Destination ``*.lance`` directory on the local filesystem.  Must not
        already exist.
    """
    bucket, prefix = _parse_s3_uri(s3_uri)
    client = _s3_client()

    keys = _list_remote_objects(client, bucket, prefix)

    if not keys:
        raise FileNotFoundError(
            f"No backup found at {s3_uri!r}; "
            f"the prefix '{prefix}/' in bucket '{bucket}' is empty."
        )

    dest_dir = Path(new_local_table_path).resolve()

    # Guard: refuse to overwrite an existing path.
    if dest_dir.exists():
        raise FileExistsError(
            f"Destination already exists: {dest_dir}.  "
            "Remove it first or choose a different path."
        )

    try:
        # The prefix stored in S3 is  <prefix>/<rel-path>.  Strip the leading
        # "<prefix>/" part to recover the relative path within the dataset.
        search_prefix = prefix if prefix.endswith("/") else prefix + "/"
        prefix_len = len(search_prefix)

        for key in keys:
            # Relative path inside the dataset directory.
            rel_path = key[prefix_len:]
            if not rel_path:
                # Skip the bare prefix "directory" marker if present.
                continue
            local_file = dest_dir / rel_path
            local_file.parent.mkdir(parents=True, exist_ok=True)
            client.download_file(bucket, key, str(local_file))

    except Exception:
        # Clean up any partial writes so callers cannot accidentally open a
        # broken table.
        if dest_dir.exists():
            shutil.rmtree(dest_dir, ignore_errors=True)
        raise
