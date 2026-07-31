"""Small shared helpers: timestamps and hashing."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    """Format a datetime as RFC 3339 UTC, millisecond precision, ending in Z."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def now_iso() -> str:
    return iso(utcnow())


def parse_iso(s: str) -> datetime:
    # s always ends in 'Z' and has millisecond precision (produced by iso()).
    body = s[:-1] if s.endswith("Z") else s
    dt = datetime.strptime(body, "%Y-%m-%dT%H:%M:%S.%f")
    return dt.replace(tzinfo=timezone.utc)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()
