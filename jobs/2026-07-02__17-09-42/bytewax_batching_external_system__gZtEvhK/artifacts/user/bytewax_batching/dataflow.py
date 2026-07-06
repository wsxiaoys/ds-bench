"""Bytewax dataflow that batches device metrics and bulk-inserts them into SQLite.

Pipeline steps:
    1. Read JSONL device-metrics from ``input.jsonl`` via a custom
       :class:`DynamicSource`.
    2. Filter out metrics whose ``metric_value`` is less than 0.
    3. Key the stream by ``device_id``.
    4. Collect items into batches with a max size of 10 and a timeout of
       1 second.
    5. Write the batches into a SQLite ``device_metrics`` table using
       ``executemany`` via a custom :class:`DynamicSink`.

After the dataflow finishes, a "Pipeline finished." message is written to
``output.log``.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from bytewax import operators as op
from bytewax.dataflow import Dataflow
from bytewax.inputs import DynamicSource, StatelessSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax.testing import run_main
from typing_extensions import override


# ---------------------------------------------------------------------------
# Configuration / paths
# ---------------------------------------------------------------------------
BASE_DIR = Path("/home/user/bytewax_batching")
INPUT_PATH = BASE_DIR / "input.jsonl"
OUTPUT_LOG_PATH = BASE_DIR / "output.log"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

# Batching parameters required by the spec.
BATCH_MAX_SIZE = 10
BATCH_TIMEOUT = timedelta(seconds=1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _read_run_id() -> str:
    """Return the current pipeline run-id, stripped of whitespace."""
    return RUN_ID_PATH.read_text().strip()


def _build_db_path(run_id: str) -> Path:
    """Build the per-run SQLite database path."""
    return BASE_DIR / f"metrics-{run_id}.db"


def _create_table(conn: sqlite3.Connection) -> None:
    """Create the ``device_metrics`` table if it does not yet exist."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS device_metrics (
            device_id     TEXT    NOT NULL,
            timestamp     TEXT    NOT NULL,
            metric_value  REAL    NOT NULL
        )
        """
    )
    conn.commit()


def _prepare_database(db_path: Path) -> None:
    """Create (or open) the SQLite database file and ensure the table exists."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    try:
        _create_table(conn)
    finally:
        conn.close()


def _write_pipeline_finished_log(log_path: Path) -> None:
    log_path.write_text("Pipeline finished.\n")


# ---------------------------------------------------------------------------
# Custom JSONL source
# ---------------------------------------------------------------------------
class JsonlSourcePartition(StatelessSourcePartition[Dict[str, Any]]):
    """Stateless source partition that emits dict records from a JSONL file.

    The entire file is loaded at construction time and the records are
    emitted one-at-a-time on subsequent ``next_batch`` calls. Once the
    file is exhausted, ``next_batch`` raises :class:`StopIteration` so
    the dataflow can terminate cleanly.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._records: List[Dict[str, Any]] = [
            json.loads(line)
            for line in path.read_text().splitlines()
            if line.strip()
        ]
        self._index = 0

    @override
    def next_batch(self) -> List[Dict[str, Any]]:
        if self._index >= len(self._records):
            raise StopIteration()
        item = self._records[self._index]
        self._index += 1
        return [item]

    @override
    def next_awake(self) -> Optional[datetime]:
        # We never need to delay; ``next_batch`` raises ``StopIteration``
        # when the file is exhausted.
        return None

    @override
    def close(self) -> None:
        # Nothing to clean up; the file was already read into memory.
        return None


class JsonlSource(DynamicSource[Dict[str, Any]]):
    """A :class:`DynamicSource` that reads a single JSONL file."""

    def __init__(self, path: Path) -> None:
        self._path = path

    @override
    def build(
        self, step_id: str, worker_index: int, worker_count: int
    ) -> JsonlSourcePartition:
        return JsonlSourcePartition(self._path)


# ---------------------------------------------------------------------------
# Custom SQLite sink (bulk-insert with executemany)
# ---------------------------------------------------------------------------
class SQLiteSinkPartition(StatelessSinkPartition[List[Dict[str, Any]]]):
    """Stateless sink partition that bulk-inserts batched records into SQLite."""

    INSERT_SQL = (
        "INSERT INTO device_metrics (device_id, timestamp, metric_value) "
        "VALUES (?, ?, ?)"
    )

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._conn = sqlite3.connect(str(db_path))
        # Ensure the table exists before any writes happen.
        _create_table(self._conn)

    @override
    def write_batch(self, items: List[List[Dict[str, Any]]]) -> None:
        """Insert every record in the supplied batches with a single
        ``executemany``.

        ``items`` is a list of batches where each batch is itself a list of
        metric dictionaries as emitted by ``op.collect``. We flatten those
        into a single sequence of ``(device_id, timestamp, metric_value)``
        tuples and run one ``executemany`` for the highest possible insert
        throughput.
        """
        if not items:
            return

        rows: List[tuple] = []
        for batch in items:
            for record in batch:
                rows.append(
                    (
                        record["device_id"],
                        record["timestamp"],
                        record["metric_value"],
                    )
                )

        if not rows:
            return

        with self._conn:
            self._conn.executemany(self.INSERT_SQL, rows)

    @override
    def close(self) -> None:
        try:
            self._conn.commit()
        finally:
            self._conn.close()


class SQLiteSink(DynamicSink[List[Dict[str, Any]]]):
    """A :class:`DynamicSink` that writes batched records into a SQLite database."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    @override
    def build(
        self, step_id: str, worker_index: int, worker_count: int
    ) -> SQLiteSinkPartition:
        return SQLiteSinkPartition(self._db_path)


# ---------------------------------------------------------------------------
# Dataflow construction
# ---------------------------------------------------------------------------
def build_dataflow(flow: Dataflow, db_path: Path) -> None:
    """Wire the dataflow together using ``db_path`` as the SQLite target."""
    # 1. Read the JSONL input file.
    metrics = op.input("input", flow, JsonlSource(INPUT_PATH))

    # 2. Drop any metrics whose ``metric_value`` is below 0.
    metrics = op.filter(
        "filter_non_negative",
        metrics,
        lambda record: record["metric_value"] >= 0,
    )

    # 3. Group metrics by ``device_id`` (keying the stream).
    keyed = op.key_on(
        "key_by_device", metrics, lambda record: record["device_id"]
    )

    # 4. Batch each device's metrics up to ``BATCH_MAX_SIZE`` items or
    #    ``BATCH_TIMEOUT``, whichever comes first.
    batched = op.collect(
        "batch_metrics",
        keyed,
        timeout=BATCH_TIMEOUT,
        max_size=BATCH_MAX_SIZE,
    )

    # ``op.collect`` on a ``KeyedStream`` still emits ``(key, list)`` tuples,
    # so strip the grouping key before handing batches to the SQLite sink
    # (the ``device_id`` is already carried inside each metric record).
    batches = op.key_rm("drop_device_key", batched)

    # 5. Write the batches into SQLite via our custom sink.
    op.output("sqlite_sink", batches, SQLiteSink(db_path))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    # Determine the database path for this run.
    run_id = _read_run_id()
    db_path = _build_db_path(run_id)

    # Make sure the DB file and table exist before the dataflow runs.
    _prepare_database(db_path)

    # Build and run the dataflow.
    flow = Dataflow("device_metrics_batching")
    build_dataflow(flow, db_path)

    # Block until the dataflow finishes.
    run_main(flow)

    # Once execution completes, record the success message.
    _write_pipeline_finished_log(OUTPUT_LOG_PATH)


if __name__ == "__main__":
    main()
