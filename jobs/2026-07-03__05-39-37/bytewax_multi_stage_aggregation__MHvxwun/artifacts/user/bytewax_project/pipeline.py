"""Multi-Stage Aggregation dataflow in Bytewax.

Stage 1: locally aggregate sensor readings by `sensor_id`, summing
their `val` fields over the finite input stream.
Stage 2: re-key every local sum to a single global key and compute the
grand total of all sensor values.
"""

import json

import bytewax.operators as op
from bytewax.connectors.files import FileSource
from bytewax.connectors.stdio import StdOutSink
from bytewax.dataflow import Dataflow


def parse_line(line: str):
    """Parse a JSONL line into a ``(sensor_id, val)`` keyed item."""
    obj = json.loads(line)
    return (obj["sensor_id"], obj["val"])


def add(a, b):
    """Sum two values."""
    return a + b


flow = Dataflow("multi_stage_aggregation")

# --- Source: read the JSONL file line by line ---
# FileSource yields one `str` per line.
inp = op.input("read_input", flow, FileSource("input.jsonl"))

# --- Stage 1: Local Aggregation ---
# Parse each line into a (sensor_id, val) KeyedStream, then sum
# the values per sensor over the whole finite stream.
keyed = op.map("parse", inp, parse_line)
local_sums = op.reduce_final("local_sum", keyed, add)

# --- Stage 2: Global Aggregation ---
# Re-key every local sum to a single global key, then sum all the
# local sums into a grand total.
global_keyed = op.map("rekey_global", local_sums, lambda item: ("global", item[1]))
grand_total = op.reduce_final("global_sum", global_keyed, add)

# --- Sink: print the final grand total to stdout ---
op.output("print_result", grand_total, StdOutSink())