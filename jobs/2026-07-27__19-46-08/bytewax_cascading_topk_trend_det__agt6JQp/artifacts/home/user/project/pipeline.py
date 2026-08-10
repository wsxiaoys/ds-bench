"""Bytewax pipeline: Cascading Top-K & Trend Detection over Event-Time Windows."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import (
    EventClock,
    TumblingWindower,
    fold_window,
)
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALIGN_TO = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
WINDOW_LENGTH = timedelta(seconds=60)
N = 3  # rolling history size
K = 3  # top-K

PROJECT_DIR = Path("/home/user/project")
EVENTS_PATH = PROJECT_DIR / "data" / "events.jsonl"
OUT_DIR = PROJECT_DIR / "out"
TOPK_PATH = OUT_DIR / "topk.jsonl"
TRENDING_PATH = OUT_DIR / "trending.jsonl"


# ---------------------------------------------------------------------------
# Input source
# ---------------------------------------------------------------------------

class EventsPartition(StatefulSourcePartition):
    """Reads JSONL events from the input file."""

    def __init__(self):
        with open(EVENTS_PATH) as f:
            self._lines = [line.strip() for line in f if line.strip()]
        self._idx = 0
        self._eof = False

    def next_batch(self) -> List[dict]:
        if self._idx >= len(self._lines):
            if not self._eof:
                self._eof = True
                raise StopIteration()
            return []
        line = self._lines[self._idx]
        self._idx += 1
        return [json.loads(line)]

    def snapshot(self):
        return self._idx

    def next_awake(self):
        return None


class EventsSource(FixedPartitionedSource):
    def list_parts(self):
        return ["singleton"]

    def build_part(self, step_id, for_part, resume_state):
        part = EventsPartition()
        if resume_state is not None:
            part._idx = resume_state
        return part


# ---------------------------------------------------------------------------
# Output sinks
# ---------------------------------------------------------------------------

class JSONLSinkPartition(StatelessSinkPartition):
    def __init__(self, path: Path):
        self._path = path
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._file = None

    def write_batch(self, items: List[dict]) -> None:
        if self._file is None:
            self._file = open(self._path, "w")
        for item in items:
            self._file.write(json.dumps(item) + "\n")
        self._file.flush()

    def close(self) -> None:
        if self._file:
            self._file.close()


class JSONLSink(DynamicSink):
    def __init__(self, path: Path):
        self._path = path

    def build(self, step_id, worker_index, worker_count):
        return JSONLSinkPartition(self._path)


# ---------------------------------------------------------------------------
# Build the dataflow
# ---------------------------------------------------------------------------

def build_flow() -> Dataflow:
    flow = Dataflow("cascading_topk_trending")

    # ---- Input & Parse ----
    stream = op.input("input", flow, EventsSource())

    def parse_event(event: dict) -> Tuple[str, datetime]:
        return (event["item"], datetime.fromisoformat(event["ts"]))

    parsed = op.map("parse", stream, parse_event)

    # ---- Stage 1: Windowed counts ----
    keyed = op.key_on("key_by_item", parsed, lambda x: x[0])

    def ts_getter(x: Tuple[str, datetime]) -> datetime:
        return x[1]

    clock = EventClock(
        ts_getter=ts_getter,
        wait_for_system_duration=timedelta(seconds=0),
    )
    windower = TumblingWindower(length=WINDOW_LENGTH, align_to=ALIGN_TO)

    wo = fold_window(
        "count_per_window",
        keyed,
        clock,
        windower,
        builder=lambda: 0,
        folder=lambda s, v: s + 1,
        merger=lambda s1, s2: s1 + s2,
    )
    # wo.down: (item, (window_idx, count))

    # ---- Stage 2: Per-item rolling history ----
    stage2_keyed = op.key_on("key_for_stage2", wo.down, lambda x: x[0])

    # Per-item state: sorted list of (window_idx, count) pairs
    ItemState = List[Tuple[int, int]]

    def rolling_mapper(
        state: Optional[ItemState],
        value: Tuple[str, Tuple[int, int]],
    ) -> Tuple[Optional[ItemState], dict]:
        item, (window_idx, count) = value

        if state is None:
            state = []

        # Update: replace if same window, otherwise append
        new_state = []
        replaced = False
        for wi, c in state:
            if wi == window_idx:
                new_state.append((wi, count))
                replaced = True
            else:
                new_state.append((wi, c))
        if not replaced:
            new_state.append((window_idx, count))

        # Sort by window index ascending
        new_state.sort(key=lambda x: x[0])

        # Keep only the most recent N windows
        if len(new_state) > N:
            new_state = new_state[-N:]

        # Rolling total
        rolling_total = sum(c for _, c in new_state)

        # Growth for this window result
        pos = next(i for i, (wi, _) in enumerate(new_state) if wi == window_idx)
        if pos > 0:
            prev_count = new_state[pos - 1][1]
            growth = count - prev_count
        else:
            prev_count = 0
            growth = 0

        result = {
            "item": item,
            "window": window_idx,
            "count": count,
            "rolling_total": rolling_total,
            "prev_count": prev_count,
            "growth": growth,
        }

        return (new_state, result)

    item_updates = op.stateful_map("rolling_history", stage2_keyed, rolling_mapper)

    # ---- Trending feed ----
    def extract_trending(keyed_update: tuple) -> Optional[dict]:
        _key, update = keyed_update
        if update["growth"] > 5:
            return {
                "item": update["item"],
                "window": update["window"],
                "count": update["count"],
                "prev_count": update["prev_count"],
                "growth": update["growth"],
            }
        return None

    trending_stream = op.filter_map("extract_trending", item_updates, extract_trending)
    op.output("output_trending", trending_stream, JSONLSink(TRENDING_PATH))

    # ---- Global Top-K feed ----
    def extract_update(keyed_update: tuple) -> dict:
        return keyed_update[1]

    updates_unkeyed = op.map("extract_update", item_updates, extract_update)
    global_keyed = op.key_on("global_key", updates_unkeyed, lambda x: "__global__")

    # Global state: dict item -> rolling_total
    GlobalState = Dict[str, int]

    def global_topk_mapper(
        state: Optional[GlobalState],
        update: dict,
    ) -> Tuple[Optional[GlobalState], Optional[List[dict]]]:
        item = update["item"]
        rolling_total = update["rolling_total"]

        if state is None:
            state = {}

        state[item] = rolling_total

        # Compute top-K
        sorted_items = sorted(state.items(), key=lambda x: (-x[1], x[0]))
        topk = sorted_items[:K]

        result = [
            {"rank": i + 1, "item": it, "rolling_total": rt}
            for i, (it, rt) in enumerate(topk)
        ]

        return (state, result)

    topk_stream = op.stateful_map("global_topk", global_keyed, global_topk_mapper)

    def extract_topk_list(keyed_topk: tuple) -> Optional[List[dict]]:
        return keyed_topk[1]

    topk_unkeyed = op.filter_map("extract_topk", topk_stream, extract_topk_list)

    def flatten_topk(topk_list: List[dict]) -> List[dict]:
        return topk_list

    topk_flat = op.flat_map("flatten_topk", topk_unkeyed, flatten_topk)
    op.output("output_topk", topk_flat, JSONLSink(TOPK_PATH))

    return flow


flow = build_flow()
