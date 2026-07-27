import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import bytewax.operators as op
from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink
from bytewax.operators.windowing import TumblingWindower, EventClock, fold_window

# Define the dataflow
flow = Dataflow("flow")

# 1. Input Source
lines = op.input("input", flow, FileSource("data/events.jsonl"))

# 2. Parse JSON
def parse_line(line):
    data = json.loads(line)
    return data["item"], data

parsed = op.map("parse", lines, parse_line)

# 3. Windowing Configuration
def extract_timestamp(data):
    return datetime.fromisoformat(data["ts"])

clock = EventClock(
    ts_getter=extract_timestamp,
    wait_for_system_duration=timedelta(seconds=0)
)

windower = TumblingWindower(
    length=timedelta(seconds=60),
    align_to=datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
)

# 4. Stage 1: Windowed Aggregation (Tumbling Event-Time Window of 60s)
windowed = fold_window(
    "stage1_count",
    parsed,
    clock,
    windower,
    builder=lambda: 0,
    folder=lambda acc, x: acc + 1,
    merger=lambda a, b: a + b
)

# 5. Stage 2: Rolling History & Stateful Computations
# We map the windowed output to include the key in the value part
def attach_key(item_with_window_result):
    item, (window_index, count) = item_with_window_result
    return item, (item, window_index, count)

attached = op.map("attach_key", windowed.down, attach_key)

# Stateful mapper to maintain rolling history, compute growth/trending, and rolling total
def stage2_mapper(state, val):
    if state is None:
        state = []
    
    item, window_index, count = val
    
    trending_record = None
    if state:
        prev_window, prev_count = state[-1]
        growth = count - prev_count
        if growth > 5:
            trending_record = {
                "item": item,
                "window": window_index,
                "count": count,
                "prev_count": prev_count,
                "growth": growth
            }
    
    # Update rolling history of most recent N = 3 window results
    state.append((window_index, count))
    state.sort(key=lambda x: x[0])
    state = state[-3:]
    
    # Calculate rolling total
    rolling_total = sum(c for w, c in state)
    
    return state, (trending_record, rolling_total)

stateful_out = op.stateful_map("stage2_stateful", attached, stage2_mapper)

# 6. Trending Feed Output
def get_trending_record(item_with_val):
    item, (trending_record, rolling_total) = item_with_val
    if trending_record is not None:
        return item, json.dumps(trending_record)
    return None

trending_stream = op.filter_map("trending_filter", stateful_out, get_trending_record)
op.output("trending_out", trending_stream, FileSink(Path("out/trending.jsonl")))

# 7. Global Top-K Feed Output
# Keep the latest rolling total for each item at EOF
def keep_latest(acc, val):
    trending_record, rolling_total = val
    return rolling_total

final_totals = op.fold_final("final_totals", stateful_out, lambda: 0, keep_latest)

# Map all items to a single key "all" to collect them globally
keyed_for_global = op.map("global_key", final_totals, lambda x: ("all", x))

# Collect all (item, rolling_total) pairs into a list at EOF
def collect_items(acc, val):
    acc.append(val)
    return acc

collected_global = op.fold_final("collect_global", keyed_for_global, list, collect_items)

# Sort, rank, and format the top K = 3 items as JSON strings
def rank_topk_and_serialize(key_with_list):
    key, items_list = key_with_list
    sorted_items = sorted(items_list, key=lambda x: (-x[1], x[0]))
    top_k = sorted_items[:3]
    
    lines = []
    for rank, (item, rolling_total) in enumerate(top_k, start=1):
        line_dict = {
            "rank": rank,
            "item": item,
            "rolling_total": rolling_total
        }
        lines.append((item, json.dumps(line_dict)))
    return lines

topk_lines = op.flat_map("topk_flat_map", collected_global, rank_topk_and_serialize)
op.output("topk_out", topk_lines, FileSink(Path("out/topk.jsonl")))
