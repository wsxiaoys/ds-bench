"""
Read-through search cache for LanceDB, backed by a local memcached daemon.

Design notes
------------
Cache key
    SHA-256 of a canonical byte string that encodes:
        table_name  |  current_dataset_version  |  k  |  filter (or "")  |
        query_vector as little-endian float32 bytes
    This makes the key deterministic and collision-resistant without being
    overly long.

Invalidation
    A per-table version counter lives in memcached under the key
    ``ldb_ver:<table_name>``.  Every add() / update() atomically increments
    it.  Because the version is embedded in every cache key, all previously
    stored results become unreachable as soon as the counter changes.
    Because the counter is in memcached (shared memory), a bump performed by
    one CachedSearcher instance is immediately visible to every other instance
    that shares the same memcached server.

Fresh reads
    The LanceDB table is re-opened (via db.open_table) on each cache miss so
    that the query always targets the latest committed state of the dataset,
    regardless of any internal snapshot the table object might hold.
"""

from __future__ import annotations

import hashlib
import json
import struct
from typing import Any, Optional

import lancedb
import numpy as np
from pymemcache.client.base import Client as MemcachedClient


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_float32_bytes(query_vector) -> bytes:
    """Return the IEEE-754 little-endian float32 representation of the vector."""
    arr = np.asarray(query_vector, dtype=np.float32)
    return arr.tobytes()  # always little-endian on x86; use struct for portability


def _build_cache_key(table_name: str, version: int, k: int,
                     filter_str: Optional[str], query_bytes: bytes) -> str:
    """Return a stable memcached key string (≤250 bytes, no whitespace)."""
    h = hashlib.sha256()
    # Separator-based canonical encoding — each segment is length-prefixed so
    # that different field combinations cannot collide.
    for part in (
        table_name.encode(),
        str(version).encode(),
        str(k).encode(),
        (filter_str or "").encode(),
        query_bytes,
    ):
        h.update(struct.pack(">I", len(part)))  # 4-byte big-endian length prefix
        h.update(part)
    return f"ldb_cache:{h.hexdigest()}"


def _version_key(table_name: str) -> str:
    return f"ldb_ver:{table_name}"


# ---------------------------------------------------------------------------
# Public class
# ---------------------------------------------------------------------------

class CachedSearcher:
    """
    Read-through LanceDB search cache backed by memcached.

    Parameters
    ----------
    db_path : str
        Path to the LanceDB directory.
    table_name : str
        Name of the LanceDB table to query.
    memcached_host : str
        Hostname / IP of the memcached server.
    memcached_port : int
        Port of the memcached server.
    ttl_seconds : int
        Time-to-live for cached search results (seconds).
    """

    def __init__(
        self,
        db_path: str,
        table_name: str,
        memcached_host: str = "127.0.0.1",
        memcached_port: int = 11211,
        ttl_seconds: int = 300,
    ) -> None:
        self._db_path = db_path
        self._table_name = table_name
        self._ttl = ttl_seconds

        # LanceDB connection (table is re-opened on each miss to get fresh data)
        self._db = lancedb.connect(db_path)

        # Memcached client (no_delay=True reduces latency for small KV payloads)
        self._mc = MemcachedClient(
            (memcached_host, memcached_port),
            connect_timeout=5,
            timeout=5,
            no_delay=True,
        )

        # Ensure the version counter exists in memcached.
        # add() is a no-op when the key already exists, so this is safe to
        # call from multiple processes / threads concurrently.
        self._mc.add(_version_key(table_name), b"0", expire=0)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(
        self,
        query_vector,
        k: int = 10,
        filter: Optional[str] = None,
    ) -> list[dict]:
        """
        Return the k nearest neighbours for *query_vector*.

        Results are served from memcached when available; otherwise the search
        is executed against LanceDB, the result is stored in memcached, and
        then returned.

        Parameters
        ----------
        query_vector : array-like of float
            The query vector (will be cast to float32).
        k : int
            Number of nearest neighbours to return.
        filter : str, optional
            LanceDB SQL predicate to pre-filter rows (e.g. ``"category = 'A'"``)
            before the vector search.

        Returns
        -------
        list[dict]
            Each dict has exactly the keys ``id`` (int), ``category`` (str),
            and ``_distance`` (float), sorted by ascending ``_distance``.
        """
        query_bytes = _to_float32_bytes(query_vector)
        version = self.current_version()
        cache_key = _build_cache_key(
            self._table_name, version, k, filter, query_bytes
        )

        # --- cache hit path ---
        raw = self._mc.get(cache_key)
        if raw is not None:
            return json.loads(raw)

        # --- cache miss path: query LanceDB ---
        # Re-open the table so the query observes the latest committed data.
        table = self._db.open_table(self._table_name)

        query_arr = np.frombuffer(query_bytes, dtype=np.float32)

        q = (
            table.search(query_arr, vector_column_name="vector")
            .metric("l2")
            .select(["id", "category", "_distance"])
            .limit(k)
        )
        if filter:
            q = q.where(filter)

        rows = q.to_list()

        # Normalise to the required schema: {id: int, category: str, _distance: float}
        results: list[dict] = [
            {
                "id": int(row["id"]),
                "category": str(row["category"]),
                "_distance": float(row["_distance"]),
            }
            for row in rows
        ]

        # Sort ascending by distance (LanceDB normally returns them sorted, but
        # be explicit to guarantee the contract).
        results.sort(key=lambda r: r["_distance"])

        # Store in memcached; JSON is human-readable, compact, and round-trips
        # the three required types without loss.
        self._mc.set(cache_key, json.dumps(results).encode(), expire=self._ttl)

        return results

    def add(self, rows: list[dict]) -> None:
        """
        Append *rows* to the LanceDB table and invalidate cached results.

        Parameters
        ----------
        rows : list[dict]
            Each dict must contain ``id`` (int), ``category`` (str), and
            ``vector`` (list[float]) matching the table schema.
        """
        table = self._db.open_table(self._table_name)
        table.add(rows)
        self._bump_version()

    def update(self, where: str, values: dict) -> None:
        """
        Update matching rows in the LanceDB table and invalidate cached results.

        Parameters
        ----------
        where : str
            SQL predicate identifying rows to update (e.g. ``"id = 42"``).
        values : dict
            Column → new-value mapping (e.g. ``{"category": "B"}``).
        """
        table = self._db.open_table(self._table_name)
        table.update(where=where, values=values)
        self._bump_version()

    def current_version(self) -> int:
        """Return the current dataset version counter from memcached."""
        raw = self._mc.get(_version_key(self._table_name))
        if raw is None:
            # Counter disappeared (e.g. memcached restarted); re-initialise.
            self._mc.add(_version_key(self._table_name), b"0", expire=0)
            return 0
        return int(raw)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _bump_version(self) -> None:
        """Atomically increment the per-table version counter in memcached."""
        result = self._mc.incr(_version_key(self._table_name), 1)
        if result is None:
            # Key went missing (e.g. memcached restart between add and incr);
            # re-seed the counter at 1 so new misses get a fresh key space.
            self._mc.add(_version_key(self._table_name), b"1", expire=0)
