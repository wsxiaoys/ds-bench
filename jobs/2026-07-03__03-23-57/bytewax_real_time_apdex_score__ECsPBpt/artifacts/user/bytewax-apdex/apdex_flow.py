import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import TumblingWindower, EventClock, fold_window
from bytewax.connectors.files import FileSource, FileSink
from bytewax.testing import run_main

def extract_timestamp(item):
    ts_str = item["timestamp"]
    if ts_str.endswith("Z"):
        ts_str = ts_str[:-1] + "+00:00"
    return datetime.fromisoformat(ts_str)

def update_acc(acc, item):
    rt = item["response_time_ms"]
    acc["total"] += 1
    if rt <= 500:
        acc["satisfied"] += 1
    elif rt <= 2000:
        acc["tolerating"] += 1
    return acc

def merge_accs(acc1, acc2):
    return {
        "satisfied": acc1["satisfied"] + acc2["satisfied"],
        "tolerating": acc1["tolerating"] + acc2["tolerating"],
        "total": acc1["total"] + acc2["total"],
    }

def format_result(item):
    key, (acc, meta) = item
    service, _ = key.split("::", 1)
    
    satisfied = acc["satisfied"]
    tolerating = acc["tolerating"]
    total = acc["total"]
    
    if total > 0:
        apdex_score = (satisfied + (tolerating / 2.0)) / total
    else:
        apdex_score = 0.0
        
    return {
        "window_start": meta.open_time.isoformat().replace("+00:00", "Z"),
        "service": service,
        "apdex_score": round(apdex_score, 2)
    }

# Define the dataflow
flow = Dataflow("apdex_calculation")

# Read input line-by-line
input_path = Path("input.jsonl")
up = op.input("input_file", flow, FileSource(input_path))

# Parse JSON lines
parsed = op.map("parse_json", up, json.loads)

# Key by service (keys must be strings)
keyed = op.key_on("key_by_service", parsed, lambda x: x["service"])

# Setup EventClock and TumblingWindower
clock = EventClock(
    ts_getter=extract_timestamp,
    wait_for_system_duration=timedelta(seconds=0)
)

windower = TumblingWindower(
    length=timedelta(seconds=10),
    align_to=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
)

# Aggregate with fold_window
windowed = fold_window(
    "fold_window",
    keyed,
    clock,
    windower,
    builder=lambda: {"satisfied": 0, "tolerating": 0, "total": 0},
    folder=update_acc,
    merger=merge_accs,
)

# Map downstream and metadata streams to string keys for joining
keyed_down = op.map("key_down", windowed.down, lambda x: (f"{x[0]}::{x[1][0]}", x[1][1]))
keyed_meta = op.map("key_meta", windowed.meta, lambda x: (f"{x[0]}::{x[1][0]}", x[1][1]))

# Join window output with window metadata
joined = op.join("join_down_meta", keyed_down, keyed_meta)

# Format the results
results = op.map("format_result", joined, format_result)

# Convert results to JSON strings (FileSink requires a keyed stream of (key, value))
formatted = op.map("format_output", results, lambda x: (x["service"], json.dumps(x)))

# Write to output file
output_path = Path("output.jsonl")
op.output("write_output", formatted, FileSink(output_path))

if __name__ == "__main__":
    run_main(flow)
