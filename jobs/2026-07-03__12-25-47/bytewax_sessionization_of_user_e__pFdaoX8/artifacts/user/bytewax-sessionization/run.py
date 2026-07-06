"""Sessionize user events using Bytewax."""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import EventClock, SessionWindower, collect_window
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax._bytewax import run_main
from typing_extensions import override


INPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_events.jsonl")
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sessions.jsonl")


def parse_timestamp(ts: str) -> datetime:
    """Parse an ISO 8601 timestamp string into an aware datetime in UTC."""
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def format_timestamp(dt: datetime) -> str:
    """Format a datetime back into an ISO 8601 string with 'Z' suffix."""
    dt_utc = dt.astimezone(timezone.utc)
    s = dt_utc.isoformat()
    if s.endswith("+00:00"):
        s = s[:-6] + "Z"
    return s


def summarize_session(window_id_and_events: Tuple[int, List[dict]]) -> dict:
    """Compute summary metrics for a session of events.

    ``collect_window`` emits each window as ``(window_id, List[event])``.
    """
    _window_id, events = window_id_and_events
    times = [parse_timestamp(e["timestamp"]) for e in events]
    return {
        "session_start": format_timestamp(min(times)),
        "session_end": format_timestamp(max(times)),
        "event_count": len(events),
    }


class JSONLSource(FixedPartitionedSource[str, int]):
    """Read items from a JSON lines file, one item per line."""

    def __init__(self, path: str):
        self._path = path

    @override
    def list_parts(self) -> List[str]:
        return ["singleton"]

    @override
    def build_part(
        self, step_id: str, for_part: str, resume_state: Optional[int]
    ) -> "JSONLPartition":
        return JSONLPartition(self._path, resume_state)


class JSONLPartition(StatefulSourcePartition[str, int]):
    def __init__(self, path: str, resume_state: Optional[int]):
        self._path = path
        self._resume_state = resume_state if resume_state is not None else 0
        self._done = False

    @override
    def next_batch(self) -> List[str]:
        if self._done:
            raise StopIteration()
        with open(self._path, "r") as f:
            lines = f.readlines()
        batch = [line.rstrip("\n") for line in lines[self._resume_state:]]
        self._done = True
        self._resume_state = len(lines)
        return batch

    @override
    def snapshot(self) -> int:
        return self._resume_state


class JSONLSink(DynamicSink[dict]):
    """Write each output dict as a JSON line to the output file."""

    def __init__(self, path: str):
        self._path = path

    @override
    def build(
        self, step_id: str, worker_index: int, worker_count: int
    ) -> "JSONLSinkPartition":
        return JSONLSinkPartition(self._path)


class JSONLSinkPartition(StatelessSinkPartition[dict]):
    def __init__(self, path: str):
        self._fh = open(path, "w")

    @override
    def write_batch(self, items: List[dict]) -> None:
        for item in items:
            self._fh.write(json.dumps(item))
            self._fh.write("\n")
        self._fh.flush()

    @override
    def close(self) -> None:
        self._fh.close()


def build_flow() -> Dataflow:
    flow = Dataflow("sessionization")

    # Read raw JSON lines from the input file.
    raw = op.input("in", flow, JSONLSource(INPUT_PATH))

    # Parse JSON lines into event dicts.
    events = op.map("parse", raw, lambda line: json.loads(line))

    # Group events by user_id.
    keyed = op.key_on("by_user", events, lambda e: e["user_id"])

    # Event time clock: extract datetime from each event's timestamp field.
    clock = EventClock(
        lambda e: parse_timestamp(e["timestamp"]),
        wait_for_system_duration=timedelta(seconds=1),
    )

    # Session window with 30-minute inactivity gap.
    windower = SessionWindower(gap=timedelta(minutes=30))

    # Collect events in each session.
    windows = collect_window("session", keyed, clock, windower)

    # `windows.down` is KeyedStream keyed by user_id; value is (window_id, List[event]).
    # Compute session summary metrics from the collected events.
    summaries = op.map_value("summarize", windows.down, summarize_session)

    # Map each (user_id, summary) into the final output record.
    out = op.map("format_output", summaries, lambda kv: {
        "user_id": kv[0],
        "session_start": kv[1]["session_start"],
        "session_end": kv[1]["session_end"],
        "event_count": kv[1]["event_count"],
    })

    op.output("out", out, JSONLSink(OUTPUT_PATH))
    return flow


if __name__ == "__main__":
    flow = build_flow()
    run_main(flow)
