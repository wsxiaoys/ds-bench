# Bytewax Batching to SQLite

## Background
You have a high-throughput stream of device metrics that needs to be written to a SQLite database. To optimize database performance, you must collect and batch these metrics before performing bulk inserts, rather than inserting them one by one.

## Requirements
- Build a Bytewax dataflow in `/home/user/bytewax_batching/dataflow.py` that reads device metrics from `/home/user/bytewax_batching/input.jsonl`.
- Filter out any metrics where `metric_value` is less than 0.
- Group the metrics by `device_id`.
- Batch the metrics for each device using a maximum batch size of 10 and a timeout of 1 second.
- Write the batched metrics to a SQLite database using a custom Bytewax Sink that performs bulk inserts with `executemany`.
- Create a table named `device_metrics` in the SQLite database with the following schema:
  - `device_id` (TEXT)
  - `timestamp` (TEXT)
  - `metric_value` (REAL)
- Write a log message `Pipeline finished.` to `/home/user/bytewax_batching/output.log` upon successful completion of the dataflow.

## Implementation Hints
- Read the current `run-id` from `/logs/artifacts/run-id`.
- Use Bytewax's `collect` operator (e.g. `op.collect`) to handle the batching logic with both size and time constraints.
- Implement a custom Bytewax Sink (e.g., using `DynamicSink` and `StatelessSinkPartition`) to receive the batches and execute bulk inserts using `executemany` into SQLite.
- Ensure the SQLite table is created before the dataflow starts writing.
- Name the SQLite database file `/home/user/bytewax_batching/metrics-${run-id}.db`.
- Run the Bytewax dataflow script via `python3 dataflow.py`.

