"""Point-in-time backup/restore of a local LanceDB table to a S3-compatible object store.

The public API is intentionally minimal:

    backup(local_table_path, s3_uri)
    restore(s3_uri, new_local_table_path)

Both functions talk to an S3-compatible endpoint (such as MinIO) using boto3.
Connection credentials and the endpoint URL are read from environment variables
on every call -- the module has no side effects at import time.

A snapshot is a faithful, recursive copy of the on-disk ``*.lance`` dataset
tree: every manifest, data fragment, deletion vector, transaction file and any
other file the dataset directory contains is uploaded as one S3 object under
the supplied prefix. Because every historical version of a LanceDB table is
materialised as a manifest under ``_versions/`` (plus the underlying immutable
fragments), copying the full tree guarantees that the version history survives
the round-trip.

The restore side mirrors this: objects under the prefix are downloaded back to
a temporary directory on the same filesystem as the requested destination, and
only atomically renamed into place once the entire snapshot has been written.
That way either the table is fully restored (and openable) or the destination
does not exist -- a half-written, but apparently openable, table can never be
left behind, including when the supplied prefix holds no backup at all.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Iterator, Tuple

import boto3


# ---------------------------------------------------------------------------
# S3 client helpers
# ---------------------------------------------------------------------------

_S3_URI_RE = re.compile(r"^s3://([^/]+)/?(.*)$")


def _s3_client():
    """Build a boto3 S3 client from environment variables.

    Reads credentials lazily so that merely importing :mod:`solution` does not
    attempt any network I/O or even validate the environment.
    """
    try:
        endpoint_url = os.environ["AWS_ENDPOINT_URL"]
        access_key = os.environ["AWS_ACCESS_KEY_ID"]
        secret_key = os.environ["AWS_SECRET_ACCESS_KEY"]
        region = os.environ["AWS_DEFAULT_REGION"]
    except KeyError as exc:  # pragma: no cover - guard for misconfigured env
        raise RuntimeError(
            f"Required environment variable missing for S3 access: {exc.args[0]!r}"
        ) from None
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )


def _parse_s3_uri(s3_uri: str) -> Tuple[str, str]:
    """Parse ``s3://<bucket>/<prefix...>`` into ``(bucket, prefix)``.

    A trailing slash on the prefix is optional and normalised away. The prefix
    is returned *without* a trailing slash so the caller can decide whether to
    re-attach one when constructing keys.
    """
    if not isinstance(s3_uri, str):
        raise ValueError(f"s3_uri must be a string, got {type(s3_uri).__name__}")
    match = _S3_URI_RE.match(s3_uri)
    if not match:
        raise ValueError(f"Invalid S3 URI: {s3_uri!r}")
    bucket, prefix = match.group(1), match.group(2)
    return bucket, prefix.rstrip("/")


def _object_prefix(s3_uri: str) -> Tuple[str, str]:
    """Return ``(bucket, key_prefix_with_trailing_slash)`` ready for key ops."""
    bucket, prefix = _parse_s3_uri(s3_uri)
    return bucket, (prefix + "/") if prefix else ""


# ---------------------------------------------------------------------------
# File-iteration helpers
# ---------------------------------------------------------------------------


def _iter_files(root: Path) -> Iterator[Tuple[Path, str]]:
    """Yield ``(absolute_path, relative_key)`` for every file under ``root``.

    ``relative_key`` always uses forward slashes so it can be used directly as
    an S3 object key regardless of the host operating system.
    """
    if not root.is_dir():
        raise FileNotFoundError(f"Not a directory: {root}")
    for path in root.rglob("*"):
        if path.is_file() and not path.is_symlink():
            yield path, path.relative_to(root).as_posix()


def _list_objects(client, bucket: str, prefix: str) -> list[Tuple[str, str]]:
    """List every non-empty object under ``prefix`` returning ``(full_key, rel_key)`` pairs.

    ``rel_key`` is the object key with ``prefix`` stripped, suitable to be
    interpreted as a path relative to the dataset root.
    """
    keys: list[Tuple[str, str]] = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []) or []:
            full_key = obj["Key"]
            # S3 occasionally surfaces the prefix itself as a zero-byte "object";
            # skip it because it is a directory marker rather than a real file.
            if full_key == prefix and (obj.get("Size") or 0) == 0:
                continue
            rel = full_key[len(prefix):] if prefix else full_key
            if rel:
                keys.append((full_key, rel))
    return keys


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def backup(local_table_path: str, s3_uri: str) -> None:
    """Snapshot the LanceDB dataset directory at ``local_table_path`` into ``s3_uri``.

    The entire tree under ``local_table_path`` is replicated to the S3 prefix
    given by ``s3_uri``. Because every version of a LanceDB table is recorded
    as a manifest file under ``_versions/`` alongside the corresponding
    immutable fragments and deletion vectors, copying the full tree keeps the
    complete version history reproducible through ``table.list_versions()``
    and ``table.checkout(v)``.
    """
    root = Path(local_table_path)
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"Local table path does not exist or is not a directory: {local_table_path!r}")

    bucket, prefix_with_slash = _object_prefix(s3_uri)
    client = _s3_client()

    # Re-upload every file. Existing keys with the same name are overwritten,
    # which makes a re-run of ``backup`` produce the same snapshot and keeps the
    # implementation idempotent within a single dataset revision.
    for abs_path, rel_key in _iter_files(root):
        key = prefix_with_slash + rel_key
        client.upload_file(str(abs_path), bucket, key)


def restore(s3_uri: str, new_local_table_path: str) -> None:
    """Rebuild a LanceDB dataset at ``new_local_table_path`` from ``s3_uri``.

    On success, the restored directory opens cleanly with LanceDB and exposes
    the same versions -- with the same per-version row counts -- as the
    original. If the supplied S3 prefix holds no snapshot, or any object fails
    to download, an exception is raised *before* ``new_local_table_path`` is
    finalised, so the destination is either fully restored or does not exist.
    """
    bucket, key_prefix = _object_prefix(s3_uri)
    client = _s3_client()

    # Locate the snapshot up front. Doing the listing before touching the
    # destination means we fail early with no side effects when no backup is
    # present, satisfying the "no half-written table" requirement.
    objects = _list_objects(client, bucket, key_prefix)
    if not objects:
        raise FileNotFoundError(f"No backup found at {s3_uri!r}")

    dest = Path(new_local_table_path)
    if dest.exists():
        raise FileExistsError(f"Destination already exists: {new_local_table_path!r}")

    # Make sure the parent exists so we can place a sibling tempdir there;
    # this keeps the final rename on the same filesystem (atomic on POSIX).
    dest_parent = dest.parent if str(dest.parent) else Path(".")
    dest_parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=".restore-", dir=str(dest_parent)) as tmp:
        staging = Path(tmp) / "__dataset__"
        staging.mkdir()
        try:
            for full_key, rel_key in objects:
                target = staging / rel_key
                target.parent.mkdir(parents=True, exist_ok=True)
                client.download_file(bucket, full_key, str(target))
            # All files on disk successfully -> rename into place. On POSIX,
            # rename(2) within the same filesystem is atomic.
            shutil.move(str(staging), str(dest))
        except Exception:
            # The ``with`` block will remove ``tmp``; ``shutil.rmtree`` here is
            # belt-and-braces in case the cleanup races with a partial rename.
            shutil.rmtree(staging, ignore_errors=True)
            raise
