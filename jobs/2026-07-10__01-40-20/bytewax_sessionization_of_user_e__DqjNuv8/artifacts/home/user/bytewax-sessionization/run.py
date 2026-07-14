"""Sessionization of user events using Bytewax.

Reads user events from `user_events.jsonl`, groups them into session
windows based on event time (30-minute inactivity gap), and writes
summarized sessions to `sessions.jsonl`.

Run with::

    python run.py
"""

import json
import os
from datetime import datetime, timedelta, timezone

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.operators.windowing import EventClock, SessionWindower, collect_window
from bytewax.testing import run_main

# Inactivity gap that separates two sessions for the same user.
SESSION_GAP = timedelta(minutes=30)

# Resolve paths relative to this script so it works regardless of the
# current working directory.
HERE = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(HERE, "user_events.jsonl")
OUTPUT_PATH = os.path.join(HERE, "sessions.jsonl")


def parse_iso_timestamp(value: str) -> datetime:
    """Parse an ISO 8601 timestamp into an aware UTC datetime."""
    # `datetime.fromisoformat` in Python 3.11+ accepts a trailing "Z",
    # but normalize it to a numeric offset to be safe across versions.
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def format_iso_timestamp(ts: datetime) -> str:
    """Format a datetime back into an ISO 8601 string with a "Z" suffix."""
    # Ensure we render in UTC with the "Z" suffix used by the input.
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc)
    return ts.isoformat().replace("+00:00", "Z")


def parse_event(line: str) -> dict:
    """Parse a JSON lines record into an event dict with a datetime `ts`."""
    event = json.loads(line)
    event["ts"] = parse_iso_timestamp(event["timestamp"])
    return event


def event_timestamp(event: dict) -> datetime:
    """Return the event-time timestamp used by the clock."""
    return event["ts"]


def summarize_session(window_value) -> str:
    """Turn a collected session window into a JSON lines output record.

    Receives the value of a keyed window item, i.e. a
    ``(window_id, events)`` 2-tuple, and returns the JSON-encoded
    session summary. The key (user_id) is preserved upstream so the
    output sink can route by it.
    """
    _window_id, events = window_value
    # Events arrive collected in a list; sort them by event time so the
    # first and last elements are well-defined start/end of the session.
    ordered = sorted(events, key=lambda e: e["ts"])
    session_start = format_iso_timestamp(ordered[0]["ts"])
    session_end = format_iso_timestamp(ordered[-1]["ts"])
    record = {
        "user_id": ordered[0]["user_id"],
        "session_start": session_start,
        "session_end": session_end,
        "event_count": len(ordered),
    }
    return json.dumps(record)


def build_flow() -> Dataflow:
    flow = Dataflow("sessionization")

    # 1. Read raw JSON lines from the input file.
    lines = op.input("input", flow, FileSource(INPUT_PATH))

    # 2. Parse each line into an event dict carrying a datetime.
    events = op.map("parse", lines, parse_event)

    # 3. Key the stream by user_id so sessions are tracked per user.
    keyed = op.key_on("key_on", events, lambda e: e["user_id"])

    # 4. Define an event-time clock and a session windower.
    clock = EventClock(
        ts_getter=event_timestamp,
        wait_for_system_duration=timedelta(seconds=0),
    )
    windower = SessionWindower(gap=SESSION_GAP)

    # 5. Collect all events belonging to each session window into a list.
    windowed = collect_window("collect_window", keyed, clock, windower)

    # 6. Summarize each session (count, start, end) as a JSON line.
    # `map_value` keeps the keyed-stream structure (keyed by user_id)
    # so the output sink can route items by key.
    summaries = op.map_value("summarize", windowed.down, summarize_session)

    # 7. Write the summarized sessions to the output file.
    op.output("output", summaries, FileSink(OUTPUT_PATH))

    return flow


def main() -> None:
    flow = build_flow()
    run_main(flow)


if __name__ == "__main__":
    main()