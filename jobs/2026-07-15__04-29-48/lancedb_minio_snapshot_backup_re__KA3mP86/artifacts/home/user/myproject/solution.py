"""Point-in-time snapshot backup & restore for a local LanceDB table.

A LanceDB table is a self-contained, versioned dataset directory on disk:

    <table>.lance/
        data/*.lance            # immutable data fragments
        _transactions/*.txn     # transaction logs
        _versions/*.manifest     # one manifest per version

Copying the *entire* directory tree faithfully preserves every historical
version.  This module mirrors the tree into an S3-compatible object store
(MinIO) object-by-object and rebuilds it on restore, keeping the relative
layout so that ``list_versions()`` / ``checkout(v)`` reproduce the original.
"""

import os
import shutil
import tempfile

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------

def _s3_client():
    """Build a boto3 S3 client configured for the local MinIO endpoint."""
    endpoint = os.environ.get("AWS_ENDPOINT_URL")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def _parse_s3_uri(s3_uri):
    """Split ``s3://<bucket>/<prefix>`` into ``(bucket, prefix)``.

    The returned prefix is normalised: no leading/trailing slashes, so that
    object keys can be built deterministically with a single ``/`` separator.
    """
    if not s3_uri or not s3_uri.startswith("s3://"):
        raise ValueError(f"Invalid S3 URI (expected s3://<bucket>/<prefix>): {s3_uri!r}")
    without_scheme = s3_uri[len("s3://"):]
    if not without_scheme:
        raise ValueError(f"Invalid S3 URI (missing bucket): {s3_uri!r}")
    parts = without_scheme.split("/", 1)
    bucket = parts[0]
    if not bucket:
        raise ValueError(f"Invalid S3 URI (missing bucket): {s3_uri!r}")
    prefix = parts[1] if len(parts) > 1 else ""
    # Normalise: strip surrounding slashes so the prefix is a clean path segment.
    prefix = prefix.strip("/")
    return bucket, prefix


def _key_join(prefix, relpath):
    """Build an object key from a (possibly empty) prefix and a relative path."""
    relpath = relpath.replace(os.sep, "/")
    return f"{prefix}/{relpath}" if prefix else relpath


def _list_objects(s3, bucket, prefix):
    """Yield every object key under ``prefix`` (full keys)."""
    paginator = s3.get_paginator("list_objects_v2")
    list_prefix = f"{prefix}/" if prefix else ""
    for page in paginator.paginate(Bucket=bucket, Prefix=list_prefix):
        for obj in page.get("Contents", []) or []:
            yield obj["Key"]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def backup(local_table_path, s3_uri):
    """Snapshot a local LanceDB table directory into the object store.

    Every file in the dataset tree is uploaded as one object, preserving the
    relative directory layout so that *all* versions remain restorable.
    """
    bucket, prefix = _parse_s3_uri(s3_uri)
    local_table_path = os.path.abspath(local_table_path)

    if not os.path.isdir(local_table_path):
        raise FileNotFoundError(
            f"Local LanceDB table directory not found: {local_table_path!r}"
        )

    s3 = _s3_client()

    # Walk the dataset tree and upload each file.  Using the dataset root name
    # (e.g. "mytbl.lance") as the top of the object layout keeps restore simple
    # and makes the prefix a faithful mirror of the directory.
    root_name = os.path.basename(local_table_path.rstrip(os.sep))
    count = 0
    for dirpath, _dirnames, filenames in os.walk(local_table_path):
        for fname in filenames:
            full = os.path.join(dirpath, fname)
            rel = os.path.relpath(full, local_table_path)
            key = _key_join(prefix, _key_join(root_name, rel))
            s3.upload_file(full, bucket, key)
            count += 1

    if count == 0:
        raise RuntimeError(
            f"No files found to back up under {local_table_path!r}; "
            "is this a valid LanceDB table directory?"
        )


def restore(s3_uri, new_local_table_path):
    """Rebuild a local LanceDB table from a snapshot in the object store.

    After a successful restore the table opens cleanly with LanceDB and exposes
    the identical latest data *and* the identical version history.

    If ``s3_uri`` points at a prefix with no backup, an exception is raised and
    no half-written / openable table is left at ``new_local_table_path``.
    """
    bucket, prefix = _parse_s3_uri(s3_uri)
    s3 = _s3_client()

    # Collect all object keys up-front.  If there is nothing under the prefix,
    # fail *before* touching the filesystem so we never leave a partial table.
    keys = list(_list_objects(s3, bucket, prefix))
    if not keys:
        raise FileNotFoundError(
            f"No backup found at {s3_uri!r} (no objects under prefix "
            f"'{prefix}/' in bucket '{bucket}')."
        )

    new_local_table_path = os.path.abspath(new_local_table_path)
    parent_dir = os.path.dirname(new_local_table_path)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

    # Build into a sibling temporary directory, then atomically move it into
    # place only after every object has been downloaded.  This guarantees no
    # half-written / openable table is left behind if a download fails.
    tmp_root = tempfile.mkdtemp(
        prefix=".restore-", dir=parent_dir or None
    )
    try:
        for key in keys:
            rel_from_prefix = key[len(prefix) + 1:] if prefix else key
            # rel_from_prefix looks like "<root_name>/<relpath>"
            parts = rel_from_prefix.split("/", 1)
            if len(parts) == 2:
                _root_name, rel = parts
            else:
                # Object directly under prefix with no sub-path: place it at
                # the dataset root.
                rel = parts[0]

            dest = os.path.join(tmp_root, rel)
            dest_dir = os.path.dirname(dest)
            if dest_dir:
                os.makedirs(dest_dir, exist_ok=True)
            s3.download_file(bucket, key, dest)

        # Ensure the final destination does not exist, then atomically rename.
        if os.path.lexists(new_local_table_path):
            shutil.rmtree(new_local_table_path)
        os.rename(tmp_root, new_local_table_path)
        tmp_root = None  # ownership transferred
    except ClientError as exc:
        if tmp_root is not None and os.path.isdir(tmp_root):
            shutil.rmtree(tmp_root, ignore_errors=True)
        raise
    except Exception:
        if tmp_root is not None and os.path.isdir(tmp_root):
            shutil.rmtree(tmp_root, ignore_errors=True)
        raise