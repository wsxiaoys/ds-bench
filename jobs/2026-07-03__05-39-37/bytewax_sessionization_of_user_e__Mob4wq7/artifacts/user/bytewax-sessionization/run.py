"""Sessionization of user events using Bytewax.

This dataflow reads user events from a JSON-lines file, groups them
into session windows per user based on event time (with a 30-minute
inactivity gap), and writes a summary of each session to an output
JSON-lines file.

Run with::

    python run.py
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink
import bytewax.operators as op
from bytewax.operators.windowing import EventClock, SessionWindower, collect_window

# Resolve paths relative to this script so the program works regardless of the
# current working directory it is launched from.
HERE = Path(__file__).resolve().parent
INPUT_PATH = HERE / "user_events.jsonl"
OUTPUT_PATH = HERE / "sessions.jsonl"

# A session is closed after this much event-time inactivity.
SESSION_GAP = timedelta(minutes=30)


def parse_event(line: str) -> dict:
    """Parse a JSON-lines record into an event with a `datetime` timestamp."""
    record = json.loads(line)
    # `datetime.fromisoformat` accepts a trailing "Z" on Python 3.11+.
    record["timestamp"] = datetime.fromisoformat(record["timestamp"])
    return record


def event_time(event: dict) -> datetime:
    """Return the event-time timestamp used by the `EventClock`."""
    return event["timestamp"]


def summarize_session(item) -> tuple:
    """Turn a collected session window into a `(key, json)` record.

    `item` is `(user_id, (window_id, events))` where `events` is the
    list of events gathered for that session. We return a
    `(user_id, json_string)` tuple so the downstream `FileSink` (which
    is partitioned and needs a key for routing) receives a keyed
    stream.
    """
    user_id, (_window_id, events) = item
    timestamps = [evt["timestamp"] for evt in events]
    session = {
        "user_id": user_id,
        "session_start": min(timestamps).isoformat(),
        "session_end": max(timestamps).isoformat(),
        "event_count": len(events),
    }
    return (user_id, json.dumps(session))


def build_flow() -> Dataflow:
    """Construct the sessionization dataflow."""
    flow = Dataflow("sessionization")

    # 1. Read raw JSON-lines from the input file.
    lines = op.input("read_events", flow, FileSource(str(INPUT_PATH)))

    # 2. Parse each line into an event dict with a `datetime` timestamp.
    events = op.map("parse_events", lines, parse_event)

    # 3. Key the stream by `user_id` so windowing is per-user.
    keyed = op.key_on("key_on_user", events, lambda evt: evt["user_id"])

    # 4. Define an event-time clock and a session windower.
    clock = EventClock(
        ts_getter=event_time,
        wait_for_system_duration=timedelta(seconds=0),
    )
    windower = SessionWindower(gap=SESSION_GAP)

    # 5. Collect all events that fall into each session window.
    windowed = collect_window("collect_sessions", keyed, clock, windower)

    # 6. Summarize each session into the required output format.
    summaries = op.map("summarize_sessions", windowed.down, summarize_session)

    # 7. Write the summaries to the output JSON-lines file.
    op.output("write_sessions", summaries, FileSink(OUTPUT_PATH))

    return flow


def main() -> None:
    flow = build_flow()
    # `run_main` executes the dataflow in the current thread and blocks
    # until all input is consumed and all windows have closed.
    from bytewax.testing import run_main

    run_main(flow)


if __name__ == "__main__":
    main()