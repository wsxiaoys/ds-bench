"""Read-through vector-search cache for LanceDB backed by memcached.

Provides a :class:`CachedSearcher` that fronts a LanceDB table with a
memcached read-through cache.  Cache correctness under mutation is achieved
by embedding a per-table *dataset version* (stored in memcached and bumped on
every ``add``/``update``) into the cache key.  Bumping the version makes all
previously cached entries for that table unreachable, which is how stale
results are invalidated across processes and connections.
"""

from __future__ import annotations

import hashlib
import json

import numpy as np
import lancedb
from pymemcache.client.base import Client


class CachedSearcher:
    """A read-through search cache in front of a LanceDB table.

    Parameters
    ----------
    db_path:
        Filesystem path to the LanceDB directory.
    table_name:
        Name of the table inside the LanceDB database.
    memcached_host, memcached_port:
        Address of the memcached daemon.
    ttl_seconds:
        Time-to-live applied to every cached search result.
    """

    def __init__(
        self,
        db_path,
        table_name,
        memcached_host="127.0.0.1",
        memcached_port=11211,
        ttl_seconds=300,
    ):
        self.db_path = db_path
        self.table_name = table_name
        self.ttl_seconds = ttl_seconds

        # --- LanceDB -----------------------------------------------------
        self.db = lancedb.connect(db_path)
        self.table = self.db.open_table(table_name)

        # --- memcached ---------------------------------------------------
        self.mc = Client((memcached_host, memcached_port))

        # Per-table dataset-version counter, shared across all instances and
        # processes via memcached.  ``add`` only stores the value when the key
        # does not already exist, so this is a safe race-free initialiser.
        self._version_key = f"lance_version:{table_name}"
        self.mc.add(self._version_key, b"0")

    # ------------------------------------------------------------------ #
    # Version management
    # ------------------------------------------------------------------ #
    def current_version(self) -> int:
        """Return the current dataset version for this table."""
        raw = self.mc.get(self._version_key)
        if raw is None:
            return 0
        return int(raw)

    def _bump_version(self) -> int:
        """Atomically increment the per-table dataset version."""
        new_val = self.mc.incr(self._version_key, 1)
        if new_val is None:
            # Counter vanished (e.g. memcached was flushed).  Re-initialise and
            # bump so writers always make progress.
            self.mc.add(self._version_key, b"0")
            new_val = self.mc.incr(self._version_key, 1)
        return int(new_val)

    # ------------------------------------------------------------------ #
    # Cache-key construction
    # ------------------------------------------------------------------ #
    def _cache_key(self, query_vector, k, filter_str, version) -> str:
        """Build a stable, collision-resistant cache key.

        The key is derived from a canonical encoding of the query vector
        (its float32 byte representation) together with ``k``, the filter
        predicate, the table name and the current dataset version.  Identical
        ``(query_vector, k, filter)`` against the same data map to the same
        key; differing inputs map to different keys.
        """
        vec = np.asarray(query_vector, dtype=np.float32)
        # ``tobytes`` gives a canonical, endianness-stable representation.
        vec_bytes = vec.tobytes()

        h = hashlib.sha256()
        h.update(vec_bytes)
        h.update(str(int(k)).encode("utf-8"))
        h.update((filter_str or "").encode("utf-8"))
        h.update(self.table_name.encode("utf-8"))
        h.update(str(int(version)).encode("utf-8"))
        digest = h.hexdigest()

        return f"lancecache:{self.table_name}:{version}:{digest}"

    # ------------------------------------------------------------------ #
    # Search
    # ------------------------------------------------------------------ #
    def search(self, query_vector, k=10, filter=None) -> list[dict]:
        """Run a cached vector search.

        On a cache hit the cached result is returned without touching
        LanceDB.  On a miss the LanceDB L2 search is executed against the
        latest committed state of the table, the result is serialised into
        memcached with the configured TTL, and then returned.
        """
        version = self.current_version()
        key = self._cache_key(query_vector, k, filter, version)

        # --- cache hit ---------------------------------------------------
        cached = self.mc.get(key)
        if cached is not None:
            return json.loads(cached)

        # --- cache miss --------------------------------------------------
        # Ensure we observe the latest committed state of the table rather
        # than the snapshot that was current when the table handle was first
        # opened (other instances may have written since then).
        self.table.checkout_latest()

        query = np.asarray(query_vector, dtype=np.float32).tolist()
        builder = (
            self.table.search(query)
            .metric("L2")
            .select(["id", "category"])
            .limit(k)
        )
        if filter:
            builder = builder.where(filter)

        rows = builder.to_list()

        # Normalise every row to exactly {id:int, category:str, _distance:float}
        # preserving LanceDB's ascending-_distance ordering.
        result = [
            {
                "id": int(r["id"]),
                "category": str(r["category"]),
                "_distance": float(r["_distance"]),
            }
            for r in rows
        ]

        # Serialise deterministically and round-trip through the same
        # serialisation used on a hit so that a hit returns a value that is
        # byte-for-byte identical to what the originating miss returned.
        payload = json.dumps(result, sort_keys=True)
        self.mc.set(key, payload, expire=self.ttl_seconds)
        return json.loads(payload)

    # ------------------------------------------------------------------ #
    # Mutations
    # ------------------------------------------------------------------ #
    def add(self, rows) -> None:
        """Append rows to the LanceDB table and bump the dataset version."""
        self.table.add(rows)
        self._bump_version()

    def update(self, where, values) -> None:
        """Update matching rows in LanceDB and bump the dataset version."""
        self.table.update(where=where, values=values)
        self._bump_version()