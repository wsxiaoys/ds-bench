"""LoggedSearcher: an observability wrapper around LanceDB vector search.

Every call to ``LoggedSearcher.search`` runs a real vector similarity search
against the configured articles table and persists exactly one audit row to a
``query_logs`` LanceDB table.  The audit row captures latency, the ordered list
of returned ids, hit count, the supplied identifiers, and a logging timestamp.
"""

from __future__ import annotations

import datetime
import time
from typing import Any, List, Sequence

import lancedb
import pyarrow as pa


# Explicit schema for the query_logs table.  Keeping a fixed schema guarantees
# that the audit table can always be queried programmatically, regardless of
# the data carried by any individual search call.
_LOGS_SCHEMA = pa.schema(
    [
        pa.field("query_id", pa.string()),
        pa.field("user_id", pa.string()),
        pa.field("query_text", pa.string()),
        pa.field("ts", pa.timestamp("us")),
        pa.field("latency_ms", pa.float64()),
        pa.field("hit_count", pa.int64()),
        pa.field("top_ids", pa.list_(pa.int64())),
    ]
)


class LoggedSearcher:
    """Wrap a LanceDB table search and audit every query to a logs table.

    Parameters
    ----------
    db_uri : str
        URI of the LanceDB database (e.g. ``"/path/to/data.lancedb"``).
    articles_table : str
        Name of the pre-populated table containing the 64-d embedding vectors.
    logs_table : str
        Name of the table that will receive one audit row per search.  The
        table is created lazily on the first ``search()`` call if it does not
        already exist.
    """

    def __init__(self, db_uri: str, articles_table: str, logs_table: str) -> None:
        self._db_uri = db_uri
        self._articles_table_name = articles_table
        self._logs_table_name = logs_table

        # Open the database once; lancedb connections are cheap and reusable.
        self._db = lancedb.connect(db_uri)

        # Open the articles table eagerly so that search() is fast and so that
        # a missing articles table fails loudly at construction time.
        self._articles_table = self._db.open_table(articles_table)

        # The logs table handle is opened lazily on the first search() call.
        self._logs_table = None
        self._logs_table_ready = False

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def search(
        self,
        query_vector: Sequence[float],
        top_k: int,
        query_id: str,
        user_id: str,
        query_text: str = "",
    ) -> List[dict]:
        """Run a vector similarity search and persist a single audit row.

        Returns the same list of hits that a direct
        ``table.search(query_vector).limit(top_k).to_list()`` call would
        return (each hit includes at least the ``id`` and ``title`` columns).
        """
        # Perform the real search against the articles table, measuring wall
        # clock latency with a high-resolution monotonic timer.
        start = time.perf_counter()
        hits = self._articles_table.search(query_vector).limit(top_k).to_list()
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        # latency_ms must be strictly positive.  perf_counter deltas for real
        # searches always are, but guard against pathological zero values so
        # the audit invariant holds unconditionally.
        if elapsed_ms <= 0.0:
            elapsed_ms = 1e-6

        # Extract the returned ids in rank order as plain Python ints so that
        # downstream consumers can store them as list<int64>.
        top_ids: List[int] = [int(hit["id"]) for hit in hits]

        # Timestamp taken at logging time, timezone-aware UTC.
        ts = datetime.datetime.now(datetime.timezone.utc)

        audit_row = {
            "query_id": str(query_id),
            "user_id": str(user_id),
            "query_text": str(query_text),
            "ts": ts,
            "latency_ms": float(elapsed_ms),
            "hit_count": int(len(hits)),
            "top_ids": top_ids,
        }

        self._write_audit_row(audit_row)

        return hits

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _write_audit_row(self, row: dict) -> None:
        """Persist a single audit row to the query_logs table.

        The logs table is created lazily on the first call using an explicit
        PyArrow schema; subsequent calls append to the existing table.
        """
        # Build a one-row Arrow table using the fixed schema so the on-disk
        # representation is always consistent and queryable.
        arrow_table = pa.Table.from_pylist([row], schema=_LOGS_SCHEMA)

        if not self._logs_table_ready:
            # First search: create the logs table if it does not yet exist.
            if self._logs_table_name not in self._db.table_names():
                self._logs_table = self._db.create_table(
                    self._logs_table_name,
                    data=arrow_table,
                    mode="overwrite",
                )
            else:
                self._logs_table = self._db.open_table(self._logs_table_name)
                self._logs_table.add(arrow_table)
            self._logs_table_ready = True
        else:
            self._logs_table.add(arrow_table)