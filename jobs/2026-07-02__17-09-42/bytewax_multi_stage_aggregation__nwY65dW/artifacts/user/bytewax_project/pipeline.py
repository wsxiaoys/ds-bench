"""Multi-stage aggregation pipeline using Bytewax.

Stage 1: Local aggregation by sensor_id (sum of val).
Stage 2: Global aggregation over all local sums.

Run with:
    python -m bytewax.run pipeline:flow
"""

import json
from pathlib import Path

from bytewax import operators as op
from bytewax.connectors.files import FileSource
from bytewax.connectors.stdio import StdOutSink
from bytewax.dataflow import Dataflow

flow = Dataflow("multi_stage_aggregation")

# ---------------------------------------------------------------------------
# Input: read sensor readings from a JSONL file, line-by-line.
# Each line is parsed into a dict of the form: {"sensor_id": str, "val": num}.
# ---------------------------------------------------------------------------
input_path = Path(__file__).resolve().parent / "input.jsonl"
file_lines = op.input("input", flow, FileSource(input_path))
readings = op.map("parse_json", file_lines, json.loads)


# ---------------------------------------------------------------------------
# Stage 1: Local aggregation.
# Re-key each reading by its `sensor_id`, drop the dict, then sum the
# numeric `val` per sensor using `reduce_final` (which only emits the
# final reducer result once the upstream finite stream completes).
# ---------------------------------------------------------------------------
keyed_by_sensor = op.key_on(
    "key_by_sensor",
    readings,
    lambda record: record["sensor_id"],
)
sensor_values = op.map_value(
    "extract_val",
    keyed_by_sensor,
    lambda record: record["val"],
)
local_sums = op.reduce_final(
    "sum_per_sensor",
    sensor_values,
    lambda running_sum, new_val: running_sum + new_val,
)


# ---------------------------------------------------------------------------
# Stage 2: Global aggregation.
# Drop the per-sensor key, re-key every local sum under the single key
# `"global"`, then reduce the running grand total once upstream is EOF.
# ---------------------------------------------------------------------------
local_sum_values = op.key_rm("drop_sensor_key", local_sums)
keyed_global = op.key_on(
    "key_global",
    local_sum_values,
    lambda _: "global",
)
grand_total = op.reduce_final(
    "grand_total",
    keyed_global,
    lambda running_total, new_sum: running_total + new_sum,
)


# ---------------------------------------------------------------------------
# Output: print the final grand total to standard output.
# Each line printed will be of the form: ('global', <grand_total>).
# ---------------------------------------------------------------------------
op.output("stdout", grand_total, StdOutSink())
