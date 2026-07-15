"""Read-through search cache for LanceDB backed by memcached.

Cache key encodes (table_name, query_vector as float32 bytes, k, filter,
dataset_version). The dataset version is a per-table counter held inside
memcached and atomically incremented on every ``add``/``update``. Bumping
the version makes all previously cached entries for that table unreachable,
which is how invalidation works across processes/instances.
"""

from __future__ import annotations

import hashlib
import pickle
from typing import Any, Iterable

import lancedb
import numpy as np
from pymemcache.client.base import Client


class CachedSearcher:
    def __init__(
        self,
        db_path: str,
        table_name: str,
        memcached_host: str = "127.0.0.1",
        memcached_port: int = 11211,
        ttl_seconds: int = 300,
    ) -> None:
        self.db_path = db_path
        self.table_name = table_name
        self.ttl_seconds = int(ttl_seconds)

        self.db = lancedb.connect(db_path)
        self.table = self.db.open_table(table_name)
        # Pin to the latest committed version so subsequent reads can observe
        # writes performed by other processes/connections.
        self.table.checkout_latest()

        self.cache = Client((memcached_host, memcached_port))
        self._version_key = f"dataset_version:{table_name}"

    # ------------------------------------------------------------------
    # Version counter (per-table, shared via memcached)
    # ------------------------------------------------------------------

    def _read_version(self) -> int:
        """Return the current per-table dataset version.

        Lazily initialises the counter to ``0`` if it does not yet exist.
        """
        raw = self.cache.get(self._version_key)
        if raw is not None:
            return int(raw)
        # Atomic create-if-absent. ``add`` succeeds only for the first caller.
        self.cache.add(self._version_key, b"0", expire=0)
        raw = self.cache.get(self._version_key)
        return int(raw) if raw is not None else 0

    def _bump_version(self) -> int:
        """Atomically increment the per-table dataset version."""
        new_val = self.cache.incr(self._version_key, 1)
        if new_val is not None:
            return int(new_val)
        # Counter did not exist yet. Try to seed it at 1.
        if self.cache.add(self._version_key, b"1", expire=0):
            return 1
        # Someone else seeded it between our incr and add: increment again.
        new_val = self.cache.incr(self._version_key, 1)
        return int(new_val) if new_val is not None else 1

    def current_version(self) -> int:
        return self._read_version()

    # ------------------------------------------------------------------
    # Cache key construction
    # ------------------------------------------------------------------

    def _make_cache_key(
        self,
        query_vector: Iterable[float],
        k: int,
        filter_sql: Any,
        version: int,
    ) -> str:
        # Canonical float32 byte representation of the query vector.
        vec_bytes = np.asarray(list(query_vector), dtype=np.float32).tobytes()

        h = hashlib.sha256()
        h.update(self.table_name.encode("utf-8"))
        h.update(b"\x00v\x00")
        h.update(vec_bytes)
        h.update(b"\x00k\x00")
        h.update(str(k).encode("utf-8"))
        h.update(b"\x00f\x00")
        # Distinguish ``None`` from ``""`` (different inputs -> different keys).
        h.update(b"" if filter_sql is None else str(filter_sql).encode("utf-8"))
        h.update(b"\x00ver\x00")
        h.update(str(version).encode("utf-8"))
        return f"search:{self.table_name}:{h.hexdigest()}"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(
        self,
        query_vector,
        k: int = 10,
        filter: Any = None,
    ) -> list[dict]:
        # Make sure this handle observes the latest committed state of the
        # table -- writes from other CachedSearcher instances would otherwise
        # be invisible until we re-open the table.
        self.table.checkout_latest()

        version = self._read_version()
        key = self._make_cache_key(query_vector, k, filter, version)

        cached = self.cache.get(key)
        if cached is not None:
            return pickle.loads(cached)

        # --- cache miss: run the real vector search ---
        q = np.asarray(list(query_vector), dtype=np.float32)
        builder = self.table.search(q).metric("L2").limit(int(k))
        if filter is not None:
            builder = builder.where(filter)
        rows = builder.to_list()

        cleaned: list[dict] = [
            {
                "id": int(r["id"]),
                "category": str(r["category"]),
                "_distance": float(r["_distance"]),
            }
            for r in rows
        ]

        self.cache.set(key, pickle.dumps(cleaned), expire=self.ttl_seconds)
        return cleaned

    def add(self, rows) -> None:
        self.table.add(rows)
        # Refresh our handle so a subsequent checkout_latest() reflects this
        # same write; then publish the bump so other instances invalidate too.
        self.table.checkout_latest()
        self._bump_version()

    def update(self, where: str, values: dict) -> None:
        self.table.update(where=where, values=values)
        self.table.checkout_latest()
        self._bump_version()