"""Cascading Top-K & Trend Detection over Event-Time Windows (Bytewax).

Stage 1: per-item counts per 60s tumbling event-time window.
Stage 2: stateful rolling history (N=3) per item, feeding a global
Top-K (K=3) feed and a trending-items feed.
"""

import json
from datetime import datetime, timedelta, timezone

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators.windowing import EventClock, TumblingWindower, count_window

# --- Configuration -----------------------------------------------------

WINDOW_LENGTH = timedelta(seconds=60)
ALIGN_TO = datetime(2024, 1, 1, tzinfo=timezone.utc)
N = 3  # rolling history size
K = 3  # top-K size
GROWTH_THRESHOLD = 5

INPUT_PATH = "data/events.jsonl"
TOPK_PATH = "out/topk.jsonl"
TRENDING_PATH = "out/trending.jsonl"

flow = Dataflow("cascading_topk_trending")

# --- Input ---------------------------------------------------------------

lines = op.input("read_events", flow, FileSource(INPUT_PATH))


def parse_event(line: str):
    obj = json.loads(line)
    return {"item": obj["item"], "ts": datetime.fromisoformat(obj["ts"])}


events = op.map("parse_event", lines, parse_event)

# --- Stage 1: per-item counts per 60s tumbling event-time window ---------

clock = EventClock(
    ts_getter=lambda e: e["ts"],
    wait_for_system_duration=timedelta(seconds=0),
)
windower = TumblingWindower(length=WINDOW_LENGTH, align_to=ALIGN_TO)

window_out = count_window(
    "window_counts",
    events,
    clock,
    windower,
    key=lambda e: e["item"],
)

# window_out.down : KeyedStream[Tuple[int, int]] == (item, (window_id, count))

# --- Stage 2: rolling history / top-K / trending (stateful, batch-final) -

per_item_windows = op.fold_final(
    "collect_item_windows",
    window_out.down,
    list,
    lambda acc, v: acc + [v],
)


def build_item_summary(kv):
    item, results = kv
    results_sorted = sorted(results, key=lambda p: p[0])

    trending_lines = []
    prev_count = None
    for window_id, count in results_sorted:
        if prev_count is not None:
            growth = count - prev_count
            if growth > GROWTH_THRESHOLD:
                trending_lines.append(
                    {
                        "item": item,
                        "window": window_id,
                        "count": count,
                        "prev_count": prev_count,
                        "growth": growth,
                    }
                )
        prev_count = count

    last_n = results_sorted[-N:]
    rolling_total = sum(count for _, count in last_n)

    return {
        "item": item,
        "rolling_total": rolling_total,
        "trending_lines": trending_lines,
    }


item_summaries = op.map("build_item_summary", per_item_windows, build_item_summary)

# --- Trending feed --------------------------------------------------------


def to_trending_lines(summary):
    return summary["trending_lines"]


trending_records = op.flat_map("trending_lines", item_summaries, to_trending_lines)
trending_json = op.map("trending_to_json", trending_records, json.dumps)
trending_keyed = op.key_on("key_trending_out", trending_json, lambda _: "trending")
op.output("write_trending", trending_keyed, FileSink(TRENDING_PATH))

# --- Global Top-K feed -----------------------------------------------------

topk_pairs = op.map(
    "extract_totals", item_summaries, lambda s: (s["item"], s["rolling_total"])
)
grouped_totals = op.key_on("group_all_totals", topk_pairs, lambda _: "all")
all_totals = op.fold_final(
    "collect_totals",
    grouped_totals,
    list,
    lambda acc, v: acc + [v],
)


def build_topk_lines(kv):
    _, totals = kv
    ranked = sorted(totals, key=lambda p: (-p[1], p[0]))
    top = ranked[:K]
    return [
        {"rank": i + 1, "item": item, "rolling_total": total}
        for i, (item, total) in enumerate(top)
    ]


topk_lines = op.flat_map("topk_lines", all_totals, build_topk_lines)
topk_json = op.map("topk_to_json", topk_lines, json.dumps)
topk_keyed = op.key_on("key_topk_out", topk_json, lambda _: "topk")
op.output("write_topk", topk_keyed, FileSink(TOPK_PATH))
