"""Soft-delete tombstoning and garbage collection on top of LanceDB.

This module exposes :class:`TombstoneStore`, a thin wrapper around a local
LanceDB table that maintains a boolean ``deleted`` tombstone column and a
``deleted_at`` Unix epoch timestamp column. Tombstoned rows are hidden from
nearest-neighbour searches but kept on disk so they can be restored. A
separate :py:meth:`TombstoneStore.gc` pass hard-deletes aged tombstones and
reclaims disk space through fragment compaction and version pruning.
"""

from __future__ import annotations

import os
import time
from datetime import timedelta
from typing import Any, Dict, Iterable, List, Optional

import lancedb
import pyarrow as pa


# Fixed schema for the managed table. ``vector`` is a fixed-size list of 16
# float32 values as required by the task; ``deleted`` is the tombstone flag
# and ``deleted_at`` stores the Unix epoch seconds at which the row was
# tombstoned (``0`` while the row is live).
_TABLE_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int64(), nullable=False),
        pa.field("text", pa.utf8(), nullable=False),
        pa.field("vector", pa.list_(pa.float32(), 16), nullable=False),
        pa.field("deleted", pa.bool_(), nullable=False),
        pa.field("deleted_at", pa.int64(), nullable=False),
    ]
)


class TombstoneStore:
    """Manage a LanceDB table with soft-delete tombstoning."""

    # Default on-disk location used when no explicit path is provided.
    DEFAULT_DB_PATH = "/home/user/myproject/lancedb_data"

    def __init__(self, table_name: str, db_path: str = DEFAULT_DB_PATH) -> None:
        # Ensure the target directory exists so ``lancedb.connect`` does not
        # fail on a fresh database.
        os.makedirs(db_path, exist_ok=True)

        self.table_name = table_name
        self.db_path = db_path
        self._db = lancedb.connect(db_path)
        self._table: Optional["lancedb.table.LanceTable"] = None

        # Open the table if it already exists. New tables are not created
        # until :py:meth:`add_documents` is invoked.
        existing = set(self._db.table_names())
        if table_name in existing:
            self._table = self._db.open_table(table_name)

    # ------------------------------------------------------------------ #
    # Internal helpers                                                    #
    # ------------------------------------------------------------------ #
    def _ensure_table(self, data: List[Dict[str, Any]]) -> None:
        """Create the table on the first call, append on subsequent calls."""
        if self._table is None:
            # First batch: create the table using the canonical schema so
            # subsequent appends share the exact same shape.
            self._table = self._db.create_table(
                self.table_name, data=data, schema=_TABLE_SCHEMA
            )
        else:
            self._table.add(data)

    @staticmethod
    def _format_ids(ids: Iterable[Any]) -> str:
        """Render an iterable of ids as a comma-separated SQL literal list."""
        rendered = []
        for value in ids:
            if isinstance(value, bool) or not isinstance(value, int):
                # ``bool`` is a subclass of ``int``; reject booleans so we do
                # not silently coerce ``True``/``False`` into 1/0 ids.
                raise TypeError(f"id values must be integers, got {value!r}")
            rendered.append(str(int(value)))
        if not rendered:
            raise ValueError("at least one id is required")
        return ", ".join(rendered)

    # ------------------------------------------------------------------ #
    # Public API                                                          #
    # ------------------------------------------------------------------ #
    def add_documents(self, docs: List[Dict[str, Any]]) -> None:
        """Add documents to the table.

        Each dict must contain ``id``, ``text`` and ``vector`` (a 16-element
        list of floats). ``deleted`` and ``deleted_at`` are populated with
        ``False`` / ``0`` respectively so newly added rows are live.
        """
        if not docs:
            return

        records: List[Dict[str, Any]] = []
        for doc in docs:
            if "vector" not in doc or len(doc["vector"]) != 16:
                raise ValueError("each document must have a 16-dimensional vector")
            records.append(
                {
                    "id": int(doc["id"]),
                    "text": str(doc["text"]),
                    "vector": [float(v) for v in doc["vector"]],
                    "deleted": False,
                    "deleted_at": 0,
                }
            )
        self._ensure_table(records)

    def soft_delete(self, ids: Iterable[int]) -> int:
        """Tombstone the supplied ids in place.

        Returns the number of rows whose tombstone flag was actually set.
        """
        if self._table is None:
            return 0

        id_list = [int(i) for i in ids]
        if not id_list:
            return 0

        # Idempotency: only flip rows that are currently live so we never
        # overwrite an existing ``deleted_at`` stamp with a fresher one.
        where = (
            f"id IN ({self._format_ids(id_list)}) AND deleted = false"
        )
        result = self._table.update(
            where=where,
            values={"deleted": True, "deleted_at": int(time.time())},
        )
        return int(getattr(result, "rows_updated", 0) or 0)

    def restore(self, ids: Iterable[int]) -> int:
        """Clear the tombstone for any of ``ids`` that are currently deleted."""
        if self._table is None:
            return 0

        id_list = [int(i) for i in ids]
        if not id_list:
            return 0

        where = (
            f"id IN ({self._format_ids(id_list)}) AND deleted = true"
        )
        result = self._table.update(
            where=where,
            values={"deleted": False, "deleted_at": 0},
        )
        return int(getattr(result, "rows_updated", 0) or 0)

    def search(self, query_vector: List[float], k: int) -> List[Dict[str, Any]]:
        """Return up to ``k`` live rows ordered by L2 distance to ``query_vector``.

        Tombstoned rows are excluded via a prefilter. Ties on distance are
        broken by ascending ``id`` to obtain a deterministic ordering.
        """
        if self._table is None or k <= 0:
            return []
        if len(query_vector) != 16:
            raise ValueError("query_vector must have exactly 16 elements")

        raw = (
            self._table.search([float(v) for v in query_vector])
            .where("deleted = false", prefilter=True)
            .select(["id", "text"])
            .limit(k)
            .to_list()
        )

        # The lancedb driver emits the distance as ``_distance``; remap it
        # to the task-mandated ``distance`` key and apply a stable ordering
        # by ``(distance, id)``.
        results: List[Dict[str, Any]] = []
        for row in raw:
            results.append(
                {
                    "id": int(row["id"]),
                    "text": row["text"],
                    "distance": float(row["_distance"]),
                }
            )
        results.sort(key=lambda r: (r["distance"], r["id"]))
        return results

    def gc(self, older_than_seconds: int) -> int:
        """Permanently delete aged tombstones and reclaim disk space.

        Rows with ``deleted = true`` and ``deleted_at > 0`` whose tombstone
        has aged by at least ``older_than_seconds`` seconds are physically
        removed. The fragment layout is then compacted and obsolete table
        versions are pruned so the on-disk footprint shrinks in the same
        pass. Live rows and non-aged tombstones are left untouched.

        Returns the number of rows that were hard-deleted.
        """
        if self._table is None:
            return 0

        # Use float seconds so two operations that land in the same wall
        # clock integer second still produce a strictly-positive age.
        age_cutoff = float(time.time()) - float(older_than_seconds)
        # We compare against an integer floor of the cutoff because the
        # ``deleted_at`` column itself stores integer Unix seconds. Using
        # ``<=`` makes ``gc(0)`` reclaim rows that were tombstoned in the
        # same wall-clock second as the call, which matches the natural
        # "older than 0 seconds" reading (i.e. any tombstone at all).
        int_cutoff = int(age_cutoff)
        predicate = (
            f"deleted = true AND deleted_at > 0 AND deleted_at <= {int_cutoff}"
        )

        # Count what we are about to remove before issuing the delete so
        # the return value matches the number of rows actually hard-deleted.
        deleted_count = int(self._table.count_rows(filter=predicate) or 0)
        if deleted_count > 0:
            self._table.delete(predicate)

        # Always run compaction + version pruning so the observable
        # guarantees on fragment count and version history hold even when
        # nothing was hard-deleted on this pass.
        dataset = self._table.to_lance()
        # ``compact_files`` merges fragments and materialises pending
        # deletions on disk, which reduces the number of physical fragments.
        try:
            dataset.optimize.compact_files()
        except Exception:
            # Compaction is best-effort; if there is nothing to compact it
            # is allowed to raise on some lancedb versions.
            pass

        # ``cleanup_old_versions`` with a zero-age threshold prunes every
        # version except the latest, satisfying the version-history
        # guarantee.
        try:
            dataset.cleanup_old_versions(
                timedelta(seconds=0), delete_unverified=True
            )
        except TypeError:
            # Older lancedb releases expose ``cleanup_old_versions`` directly
            # on the table object rather than the lance dataset.
            try:
                self._table.cleanup_old_versions(
                    older_than=timedelta(seconds=0),
                    delete_unverified=True,
                )
            except Exception:
                pass
        except Exception:
            pass

        # ``cleanup_old_versions`` may have removed the manifest files for
        # versions the cached Python wrapper is still pinned to; refresh
        # the wrapper so subsequent calls operate against the latest state.
        try:
            self._table.checkout_latest()
        except Exception:
            # If we cannot refresh, fall back to reopening the table.
            try:
                self._table = self._db.open_table(self.table_name)
            except Exception:
                pass

        return deleted_count