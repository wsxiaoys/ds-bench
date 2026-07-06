import datetime
import json
import os
import sqlite3
from typing import List, Tuple

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.connectors.files import FileSource
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax.testing import run_main

# 1. Read the run-id and define database path
def get_run_id() -> str:
    run_id_path = "/logs/artifacts/run-id"
    if os.path.exists(run_id_path):
        with open(run_id_path, "r") as f:
            return f.read().strip()
    return "default"

run_id = get_run_id()
db_path = f"/home/user/bytewax_batching/metrics-{run_id}.db"
log_path = "/home/user/bytewax_batching/output.log"

# 2. Ensure the SQLite table is created before the dataflow starts writing
def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS device_metrics (
                device_id TEXT,
                timestamp TEXT,
                metric_value REAL
            )
        """)
        conn.commit()
    finally:
        conn.close()

init_db(db_path)

# 3. Implement Custom SQLite Sink
class SQLiteSinkPartition(StatelessSinkPartition):
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path, timeout=30.0)
        self.cursor = self.conn.cursor()

    def write_batch(self, items: List[Tuple[str, List[dict]]]) -> None:
        records_to_insert = []
        for device_id, metrics in items:
            for metric in metrics:
                records_to_insert.append((
                    metric.get("device_id"),
                    metric.get("timestamp"),
                    metric.get("metric_value")
                ))
        
        if records_to_insert:
            self.cursor.executemany(
                "INSERT INTO device_metrics (device_id, timestamp, metric_value) VALUES (?, ?, ?)",
                records_to_insert
            )
            self.conn.commit()

    def close(self) -> None:
        self.conn.close()

class SQLiteSink(DynamicSink):
    def __init__(self, db_path: str):
        self.db_path = db_path

    def build(self, step_id: str, worker_index: int, worker_count: int) -> SQLiteSinkPartition:
        return SQLiteSinkPartition(self.db_path)

# 4. Define Bytewax Dataflow
flow = Dataflow("device_metrics_pipeline")

# Read device metrics from input.jsonl
stream = op.input("input_step", flow, FileSource("/home/user/bytewax_batching/input.jsonl"))

# Parse JSON strings to dictionaries
def parse_json(line: str):
    line_str = line.strip()
    if not line_str:
        return None
    try:
        return json.loads(line_str)
    except Exception:
        return None

parsed_stream = op.filter_map("parse_json", stream, parse_json)

# Filter out any metrics where metric_value is less than 0
def is_valid_metric(metric: dict) -> bool:
    val = metric.get("metric_value")
    return val is not None and val >= 0

filtered_stream = op.filter("filter_negatives", parsed_stream, is_valid_metric)

# Group metrics by device_id (key the stream)
def key_by_device(metric: dict) -> Tuple[str, dict]:
    return (metric["device_id"], metric)

keyed_stream = op.map("key_by_device", filtered_stream, key_by_device)

# Batch the metrics for each device using a maximum batch size of 10 and a timeout of 1 second
batched_stream = op.collect(
    "batch_metrics",
    keyed_stream,
    timeout=datetime.timedelta(seconds=1),
    max_size=10
)

# Write the batched metrics to the SQLite database
op.output("write_to_sqlite", batched_stream, SQLiteSink(db_path))

# 5. Run the dataflow and log completion
if __name__ == "__main__":
    run_main(flow)
    
    # Write log message upon successful completion
    with open(log_path, "w") as f:
        f.write("Pipeline finished.\n")
