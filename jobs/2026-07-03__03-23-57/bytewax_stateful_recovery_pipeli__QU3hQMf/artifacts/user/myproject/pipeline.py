import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import SlidingWindower, EventClock, fold_window
from bytewax.connectors.files import FileSource, FileSink

# Helper functions for the windowing logic

def get_time(item):
    return datetime.fromisoformat(item["time"])

def get_sensor_id(item):
    return item["sensor_id"]

def builder():
    return (0, 0.0, 0.0)  # (count, sum, sum_sq)

def folder(acc, x):
    count, s, s_sq = acc
    temp = x["temp"]
    return (count + 1, s + temp, s_sq + temp ** 2)

def merger(acc1, acc2):
    count1, s1, s_sq1 = acc1
    count2, s2, s_sq2 = acc2
    return (count1 + count2, s1 + s2, s_sq1 + s_sq2)

# Helper functions for mapping and formatting

def map_down(item):
    sensor_id, (window_id, acc) = item
    return f"{sensor_id}:{window_id}", acc

def map_meta(item):
    sensor_id, (window_id, metadata) = item
    return f"{sensor_id}:{window_id}", metadata

def format_output(item):
    joined_key, (acc, metadata) = item
    sensor_id, _ = joined_key.rsplit(":", 1)
    count, s, s_sq = acc
    
    mean = s / count if count > 0 else 0.0
    variance = (s_sq / count) - (mean ** 2) if count > 0 else 0.0
    stddev = math.sqrt(max(0.0, variance)) if count > 0 else 0.0
    
    window_start = metadata.open_time.isoformat().replace("+00:00", "Z")
    window_end = metadata.close_time.isoformat().replace("+00:00", "Z")
    
    return {
        "sensor_id": sensor_id,
        "window_start": window_start,
        "window_end": window_end,
        "mean": mean,
        "stddev": stddev
    }

def to_keyed_json(item):
    return item["sensor_id"], json.dumps(item)

# Build the Bytewax dataflow

flow = Dataflow("pipeline")

# Input step
up = op.input("input", flow, FileSource(Path("input.jsonl")))

# Parse JSON lines
parsed = op.map("parse_json", up, json.loads)

# Key the stream by sensor_id
keyed = op.key_on("key_by_sensor", parsed, get_sensor_id)

# Define the clock and windower
clock = EventClock(
    ts_getter=get_time,
    wait_for_system_duration=timedelta(seconds=0)
)

windower = SlidingWindower(
    length=timedelta(seconds=60),
    offset=timedelta(seconds=30),
    align_to=datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
)

# Apply fold_window
windowed = fold_window(
    "fold_window",
    keyed,
    clock,
    windower,
    builder=builder,
    folder=folder,
    merger=merger,
)

# Map down and meta streams to use f"{sensor_id}:{window_id}" as key
downs_mapped = op.map("map_down", windowed.down, map_down)
metas_mapped = op.map("map_meta", windowed.meta, map_meta)

# Join the two streams
joined = op.join("join_window_data", downs_mapped, metas_mapped)

# Format the results as dicts
formatted = op.map("format_output", joined, format_output)

# Convert to keyed JSON strings
keyed_json_strings = op.map("to_keyed_json", formatted, to_keyed_json)

# Write to output.jsonl
op.output("output", keyed_json_strings, FileSink(Path("output.jsonl")))
