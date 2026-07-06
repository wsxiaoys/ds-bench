#!/usr/bin/env python3
"""Bytewax dataflow that batches device metrics and bulk-inserts them into SQLite."""

import datetime
import json
import sqlite3

import bytewax.operators as op
from bytewax.connectors.files import FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators import DynamicSink, StatelessSinkPartition
from bytewax.testing import run_main

INPUT_PATH = "/home/user/bytewax_batching/input.jsonl"
RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_LOG_PATH = "/home/user/bytewax_batching/output.log"

BATCH_SIZE = 10
BATCH_TIMEOUT = datetime.timedelta(seconds=1)

CREATE_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS device_metrics (
        device_id   TEXT,
        timestamp   TEXT,
        metric_value REAL
    )
"""

INSERT_SQL = (
    "INSERT INTO device_metrics (device_id, timestamp, metric_value) "
    "VALUES (?, ?, ?)"
)


def _read_run_id() -> str:
    with open(RUN_ID_PATH, "r") as f:
        return f.read().strip()


def _ensure_table(db_path: str) -> None:
    """Create the SQLite table before the dataflow starts writing."""
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(CREATE_TABLE_SQL)
        conn.commit()
    finally:
        conn.close()


class SQLiteSinkPartition(StatelessSinkPartition):
    """Receives batches of metrics and performs bulk inserts via ``executemany``."""

    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._conn = sqlite3.connect(db_path)
        # WAL mode allows concurrent writers/readers safely.
        self._conn.execute("PRAGMA journal_mode=WAL;")

    def write_batch(self, items) -> None:
        """``items`` is a list of ``(device_id, [metric_dict, ...])`` tuples."""
        rows = []
        for _device_id, metrics in items:
            for metric in metrics:
                rows.append(
                    (
                        metric["device_id"],
                        metric["timestamp"],
                        metric["metric_value"],
                    )
                )
        if rows:
            self._conn.executemany(INSERT_SQL, rows)
            self._conn.commit()

    def close(self) -> None:
        self._conn.close()


class SQLiteSink(DynamicSink):
    """Dynamic Bytewax sink writing batched metrics into SQLite."""

    def __init__(self, db_path: str) -> None:
        self._db_path = db_path

    def build(self, step_id: str, worker_index: int, worker_count: int):
        return SQLiteSinkPartition(self._db_path)


def _parse_json(line: str) -> dict:
    return json.loads(line)


def _is_non_negative(metric: dict) -> bool:
    return metric["metric_value"] >= 0


def _device_key(metric: dict) -> str:
    return metric["device_id"]


def build_flow(db_path: str) -> Dataflow:
    flow = Dataflow("device_metrics_flow")

    # 1. Read JSON lines from the input file.
    lines = op.input("read_input", flow, FileSource(INPUT_PATH))

    # 2. Parse each line into a metric dict.
    metrics = op.map("parse_json", lines, _parse_json)

    # 3. Key the stream by device_id (required for filter_value & collect).
    keyed = op.key_on("key_by_device", metrics, _device_key)

    # 4. Filter out metrics with metric_value < 0.
    filtered = op.filter_value("filter_negative", keyed, _is_non_negative)

    # 5. Batch per device: up to 10 items or 1 second of inactivity.
    batched = op.collect(
        "batch_metrics", filtered, timeout=BATCH_TIMEOUT, max_size=BATCH_SIZE
    )

    # 6. Write batches to SQLite via a custom sink performing bulk inserts.
    op.output("write_to_sqlite", batched, SQLiteSink(db_path))

    return flow


def main() -> None:
    run_id = _read_run_id()
    db_path = f"/home/user/bytewax_batching/metrics-{run_id}.db"

    # Ensure the table exists before the dataflow starts writing.
    _ensure_table(db_path)

    flow = build_flow(db_path)
    run_main(flow)

    # Log successful completion.
    with open(OUTPUT_LOG_PATH, "w") as f:
        f.write("Pipeline finished.\n")


if __name__ == "__main__":
    main()