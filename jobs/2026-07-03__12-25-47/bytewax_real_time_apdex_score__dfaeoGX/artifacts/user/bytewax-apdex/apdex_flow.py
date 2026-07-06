#!/usr/bin/env python3
"""Real-time Apdex score calculation with Bytewax.

Reads JSON line events from ``input.jsonl``, groups them in 10-second
tumbling windows per ``service`` using the event timestamp, and writes
the calculated Apdex score to ``output.jsonl``.

Each output line contains:
  - ``window_start`` (ISO 8601 string, UTC)
  - ``service``       (string)
  - ``apdex_score``    (float, rounded to 2 decimal places)

Run it with ``python apdex_flow.py``.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import (
    EventClock,
    TumblingWindower,
    fold_window,
)
from bytewax.testing import TestingSource, run_main
from bytewax.outputs import DynamicSink, StatelessSinkPartition


# ---------------------------------------------------------------------------
# Apdex thresholds (milliseconds)
# ---------------------------------------------------------------------------

APDEX_SATISFIED_MAX = 500          # response_time_ms <= 500   -> satisfied
APDEX_TOLERATING_MAX = 2000        # 500  < x <= 2000          -> tolerating
# Anything strictly greater than 2000 -> frustrated.

INPUT_PATH = "input.jsonl"
OUTPUT_PATH = "output.jsonl"
WINDOW_LENGTH = timedelta(seconds=10)


# ---------------------------------------------------------------------------
# Input loading
# ---------------------------------------------------------------------------

def _parse_timestamp(value: str) -> datetime:
    ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    else:
        ts = ts.astimezone(timezone.utc)
    return ts


def load_input_events(path: str) -> List[Tuple[str, int, datetime]]:
    """Load JSONL events as ``(service, response_time_ms, datetime)`` tuples."""
    events: List[Tuple[str, int, datetime]] = []
    if not os.path.exists(path):
        return events
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw:
                continue
            record = json.loads(raw)
            ts = _parse_timestamp(record["timestamp"])
            events.append(
                (record["service"], int(record["response_time_ms"]), ts)
            )
    return events


# ---------------------------------------------------------------------------
# Window-state / Apdex accumulator
# ---------------------------------------------------------------------------

class ApdexAccumulator:
    """A per-window tally of satisfied/tolerating/frustrated counts."""

    __slots__ = ("satisfied", "tolerating", "frustrated")

    def __init__(self) -> None:
        self.satisfied: int = 0
        self.tolerating: int = 0
        self.frustrated: int = 0

    def add(self, response_time_ms: int) -> "ApdexAccumulator":
        if response_time_ms <= APDEX_SATISFIED_MAX:
            self.satisfied += 1
        elif response_time_ms <= APDEX_TOLERATING_MAX:
            self.tolerating += 1
        else:
            self.frustrated += 1
        return self

    def merge(self, other: "ApdexAccumulator") -> "ApdexAccumulator":
        self.satisfied += other.satisfied
        self.tolerating += other.tolerating
        self.frustrated += other.frustrated
        return self

    def apdex(self) -> float:
        total = self.satisfied + self.tolerating + self.frustrated
        if total == 0:
            return 0.0
        score = (self.satisfied + self.tolerating / 2.0) / total
        return round(score, 2)


def builder() -> ApdexAccumulator:
    return ApdexAccumulator()


def folder(acc: ApdexAccumulator, value) -> ApdexAccumulator:
    """Fold one ``(service, response_time_ms, ts)`` tuple into the accumulator."""
    return acc.add(value[1])


def merger(a: ApdexAccumulator, b: ApdexAccumulator) -> ApdexAccumulator:
    return a.merge(b)


# ---------------------------------------------------------------------------
# Output sink
# ---------------------------------------------------------------------------

class _NoopSinkPartition(StatelessSinkPartition):
    def write_batch(self, items) -> None:
        return None


class JsonlFileSinkPartition(StatelessSinkPartition):
    def __init__(self, path: str) -> None:
        self._path = path

    def write_batch(self, items) -> None:
        with open(self._path, "a", encoding="utf-8") as fh:
            for item in items:
                fh.write(json.dumps(item) + "\n")


class JsonlFileSink(DynamicSink):
    """A single-partition JSONL file sink (only worker 0 writes)."""

    def __init__(self, path: str = OUTPUT_PATH) -> None:
        self._path = path

    def build(self, step_id, worker_index, worker_count):
        if worker_index == 0:
            return JsonlFileSinkPartition(self._path)
        return _NoopSinkPartition()


# ---------------------------------------------------------------------------
# Dataflow construction
# ---------------------------------------------------------------------------

def build_dataflow() -> Dataflow:
    flow = Dataflow("apdex")

    # 1. Load all input events into memory and feed them through a
    #    ``TestingSource`` (which is the simplest finite-source helper
    #    Bytewax provides).
    events = load_input_events(INPUT_PATH)
    up = op.input("in", flow, TestingSource(events))

    # 2. Key by service so each service has its own windows.
    keyed = op.key_on("key_by_service", up, lambda x: x[0])

    # 3. Event-time clock using the embedded timestamp.
    clock = EventClock(
        ts_getter=lambda item: item[2],
        wait_for_system_duration=timedelta(seconds=0),
    )

    # 4. 10-second tumbling windows aligned to the start of the first
    #    window that contains any event.
    epoch = datetime.fromtimestamp(0, tz=timezone.utc)
    if events:
        first_ts = min(ev[2] for ev in events)
    else:
        first_ts = epoch
    seconds_since_epoch = int((first_ts - epoch).total_seconds())
    window_seconds = int(WINDOW_LENGTH.total_seconds())
    snapped = seconds_since_epoch - (seconds_since_epoch % window_seconds)
    align_to = epoch + timedelta(seconds=snapped)

    windower = TumblingWindower(
        length=WINDOW_LENGTH,
        align_to=align_to,
    )

    # 5. Fold each window of events into an ApdexAccumulator.
    windowed = fold_window(
        "apdex_fold",
        keyed,
        clock,
        windower,
        builder=builder,
        folder=folder,
        merger=merger,
    )

    # 6. ``windowed.down`` is a keyed stream. Items arriving look like
    #    ``(service, (window_id, acc))``. We use ``op.map`` (not
    #    ``map_value``) so the mapper receives the full keyed tuple and
    #    can recover the service key. ``window_start`` is computed from
    #    the window id (an integer index 0, 1, 2, ...) and ``align_to``.
    def project(item) -> dict:
        service, (window_id, acc) = item
        window_start = align_to + window_id * WINDOW_LENGTH
        return {
            "window_start": window_start.isoformat().replace("+00:00", "Z"),
            "service": service,
            "apdex_score": acc.apdex(),
        }

    results = op.map("project", windowed.down, project)

    # 7. Stream the results to a JSONL file.
    op.output("out", results, JsonlFileSink(OUTPUT_PATH))

    return flow


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    if os.path.exists(OUTPUT_PATH):
        os.remove(OUTPUT_PATH)
    run_main(build_dataflow())


if __name__ == "__main__":
    main()
