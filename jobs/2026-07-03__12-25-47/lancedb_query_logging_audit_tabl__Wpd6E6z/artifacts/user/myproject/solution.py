"""LoggedSearcher: LanceDB query logger.

Wraps a LanceDB articles table's `search` method and persists an audit row
to a configurable `query_logs` LanceDB table for every retrieval.
"""

from __future__ import annotations

import datetime
import time
from typing import Any, List, Sequence

import lancedb
import pyarrow as pa


# Logical schema for the audit/log table.
# - query_id   : string  -- caller-supplied identifier for the query
# - user_id    : string  -- caller-supplied identifier of the issuing user
# - query_text : string  -- optional free-form text describing the query
# - ts         : timestamp64 (microseconds, UTC) -- logged at write time
# - latency_ms : float64 -- wall-clock latency in milliseconds, strictly > 0
# - hit_count  : int64   -- number of returned hits
# - top_ids    : list<int64> -- returned ids in rank order
_QUERY_LOGS_SCHEMA = pa.schema(
    [
        pa.field("query_id", pa.string(), nullable=False),
        pa.field("user_id", pa.string(), nullable=False),
        pa.field("query_text", pa.string(), nullable=True),
        pa.field("ts", pa.timestamp("us", tz="UTC"), nullable=False),
        pa.field("latency_ms", pa.float64(), nullable=False),
        pa.field("hit_count", pa.int64(), nullable=False),
        pa.field("top_ids", pa.list_(pa.int64()), nullable=False),
    ]
)


def _coerce_int_ids(values: Sequence[Any]) -> List[int]:
    """Convert each value in `values` to a plain Python int."""
    return [int(v) for v in values]


class LoggedSearcher:
    """Wrap a LanceDB vector table and log every search to an audit table.

    Parameters
    ----------
    db_uri : str
        Filesystem path to the LanceDB database directory.
    articles_table : str
        Name of the table containing precomputed 64-d vectors to search.
    logs_table : str
        Name of the table where audit rows are persisted. Created lazily.
    """

    def __init__(self, db_uri: str, articles_table: str, logs_table: str) -> None:
        self._db_uri = db_uri
        self._articles_table_name = articles_table
        self._logs_table_name = logs_table

        self._db = lancedb.connect(db_uri)
        self._articles = self._db.open_table(articles_table)

        # Make sure the logs table exists with the correct schema.
        if self._logs_table_name not in self._db.table_names():
            self._logs = self._db.create_table(
                self._logs_table_name, schema=_QUERY_LOGS_SCHEMA
            )
        else:
            self._logs = self._db.open_table(self._logs_table_name)

    # ------------------------------------------------------------------ #
    # Public API                                                          #
    # ------------------------------------------------------------------ #
    def search(
        self,
        query_vector: Sequence[float],
        top_k: int,
        query_id: str,
        user_id: str,
        query_text: str = "",
    ) -> List[dict]:
        """Search `articles_table` and write one audit row to `logs_table`.

        Returns the list of hits in the same shape as
        ``table.search(query_vector).limit(top_k).to_list()``.
        """
        # -- 1. Run the vector search and time it. ------------------------ #
        start = time.perf_counter()
        hits: List[dict] = (
            self._articles.search(query_vector).limit(top_k).to_list()
        )
        elapsed_seconds = time.perf_counter() - start
        latency_ms = float(elapsed_seconds) * 1000.0
        # Defensive: guarantee a strictly positive latency even on extremely
        # fast machines where perf_counter may return 0.
        if latency_ms <= 0.0:
            latency_ms = 1e-6

        # -- 2. Build the audit record. ---------------------------------- #
        top_ids = _coerce_int_ids([h["id"] for h in hits])
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        record = {
            "query_id": str(query_id),
            "user_id": str(user_id),
            "query_text": "" if query_text is None else str(query_text),
            "ts": now_utc,
            "latency_ms": latency_ms,
            "hit_count": int(len(hits)),
            "top_ids": top_ids,
        }

        # -- 3. Persist the audit row via PyArrow to keep the schema. ---- #
        audit_table = pa.table(
            {
                "query_id": [record["query_id"]],
                "user_id": [record["user_id"]],
                "query_text": [record["query_text"]],
                "ts": [record["ts"]],
                "latency_ms": [record["latency_ms"]],
                "hit_count": [record["hit_count"]],
                "top_ids": [record["top_ids"]],
            },
            schema=_QUERY_LOGS_SCHEMA,
        )
        self._logs.add(audit_table)

        # -- 4. Return hits as-is to the caller. ------------------------- #
        return hits
