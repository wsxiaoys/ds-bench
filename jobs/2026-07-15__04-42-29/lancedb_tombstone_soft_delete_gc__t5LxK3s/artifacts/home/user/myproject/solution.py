"""
Soft-delete tombstoning and garbage-collection module backed by LanceDB.

Schema
------
id          : int64
text        : utf8
vector      : fixed-size list of 16 float32
deleted     : bool
deleted_at  : int64  (Unix epoch seconds; 0 when not tombstoned)
"""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Dict, List, Any

import pyarrow as pa
import lancedb

# ---------------------------------------------------------------------------
# Fixed schema
# ---------------------------------------------------------------------------
_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int64()),
        pa.field("text", pa.utf8()),
        pa.field("vector", pa.list_(pa.float32(), 16)),
        pa.field("deleted", pa.bool_()),
        pa.field("deleted_at", pa.int64()),
    ]
)


class TombstoneStore:
    """
    Manages a LanceDB table with soft-delete tombstoning and GC support.

    Parameters
    ----------
    table_name : str
        Name of the LanceDB table to open or create.
    db_path : str
        Path to the local LanceDB database directory.
    """

    def __init__(
        self,
        table_name: str,
        db_path: str = "/home/user/myproject/lancedb_data",
    ) -> None:
        self._db = lancedb.connect(db_path)
        self._table_name = table_name

        existing = self._db.table_names()
        if table_name in existing:
            self._tbl = self._db.open_table(table_name)
        else:
            # Create an empty table with the fixed schema; actual rows arrive
            # through add_documents().
            self._tbl = self._db.create_table(
                table_name, schema=_SCHEMA, mode="create"
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @property
    def _table(self):
        """Always return the current handle (re-opens if necessary)."""
        return self._tbl

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_documents(self, docs: List[Dict[str, Any]]) -> None:
        """
        Add documents to the table.

        Each element of *docs* must contain ``id`` (int), ``text`` (str),
        and ``vector`` (list of 16 floats).  The tombstone fields are
        initialised to ``deleted=False`` and ``deleted_at=0``.

        The first call creates the table rows; subsequent calls append.
        """
        rows = [
            {
                "id": int(doc["id"]),
                "text": str(doc["text"]),
                "vector": [float(v) for v in doc["vector"]],
                "deleted": False,
                "deleted_at": 0,
            }
            for doc in docs
        ]

        # Build a PyArrow table that strictly matches _SCHEMA so that
        # LanceDB never infers a different type.
        pa_table = pa.Table.from_pylist(rows, schema=_SCHEMA)
        self._tbl.add(pa_table, mode="append")

    def soft_delete(self, ids: List[int]) -> int:
        """
        Tombstone rows whose ``id`` is in *ids*.

        Sets ``deleted = True`` and stamps ``deleted_at`` with the current
        Unix epoch seconds.  Returns the number of rows changed.
        """
        if not ids:
            return 0

        now = int(time.time())
        id_list = ", ".join(str(i) for i in ids)
        where_clause = f"id IN ({id_list}) AND deleted = false"

        # Count before update so we can report the actual change count.
        before = self._tbl.count_rows(filter=where_clause)
        if before == 0:
            return 0

        self._tbl.update(
            where=f"id IN ({id_list}) AND deleted = false",
            values={"deleted": True, "deleted_at": now},
        )
        return before

    def restore(self, ids: List[int]) -> int:
        """
        Clear the tombstone on rows whose ``id`` is in *ids* and that are
        currently tombstoned.

        Returns the number of rows changed.
        """
        if not ids:
            return 0

        id_list = ", ".join(str(i) for i in ids)
        where_clause = f"id IN ({id_list}) AND deleted = true"

        before = self._tbl.count_rows(filter=where_clause)
        if before == 0:
            return 0

        self._tbl.update(
            where=where_clause,
            values={"deleted": False, "deleted_at": 0},
        )
        return before

    def search(
        self, query_vector: List[float], k: int
    ) -> List[Dict[str, Any]]:
        """
        Nearest-neighbour search (L2) excluding tombstoned rows.

        Returns at most *k* results as dicts with keys ``id``, ``text``,
        and ``distance``, ordered by ascending distance (ties broken by
        ascending ``id``).
        """
        query = [float(v) for v in query_vector]

        raw = (
            self._tbl.search(query, vector_column_name="vector")
            .metric("l2")
            .where("deleted = false", prefilter=True)
            .limit(k)
            .select(["id", "text", "_distance"])
            .to_list()
        )

        results = [
            {
                "id": int(row["id"]),
                "text": str(row["text"]),
                "distance": float(row["_distance"]),
            }
            for row in raw
        ]

        # Sort: primary by distance ascending, secondary by id ascending.
        results.sort(key=lambda r: (r["distance"], r["id"]))
        return results[:k]

    def gc(self, older_than_seconds: float) -> int:
        """
        Hard-delete aged tombstones and reclaim disk space.

        A tombstone is "aged" when::

            deleted = True
            AND deleted_at > 0
            AND deleted_at <= now - older_than_seconds

        After deletion the method compacts table fragments and prunes
        obsolete versions so that both the fragment count and the version
        history length are strictly reduced.

        Returns the number of rows hard-deleted.
        """
        cutoff = int(time.time()) - int(older_than_seconds)
        where_clause = (
            f"deleted = true AND deleted_at > 0 AND deleted_at <= {cutoff}"
        )

        before_count = self._tbl.count_rows(filter=where_clause)
        if before_count == 0:
            # Still compact/cleanup to satisfy the fragment/version guarantee
            # if there is something to compact.
            self._tbl.compact_files()
            self._tbl.cleanup_old_versions(older_than=timedelta(seconds=0))
            return 0

        # Hard-delete the aged tombstones.
        self._tbl.delete(where_clause)

        # Compact physical data files so fragment count drops.
        self._tbl.compact_files()

        # Prune all version history that is now safe to remove.
        self._tbl.cleanup_old_versions(
            older_than=timedelta(seconds=0),
            delete_unverified=True,
        )

        return before_count
