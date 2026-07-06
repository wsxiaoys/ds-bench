"""Bytewax sessionization dataflow.

Reads user events from ``user_events.jsonl`` (one JSON object per line),
groups them into per-user sessions separated by at least 30 minutes of
inactivity using event time, and writes a summary of each closed
session as a JSON line in ``sessions.jsonl``.

Run with:

    python run.py
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bytewax.operators as op
from bytewax._bytewax import run_main
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators.windowing import (
    EventClock,
    SessionWindower,
    collect_window,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
INPUT_PATH = HERE / "user_events.jsonl"
OUTPUT_PATH = HERE / "sessions.jsonl"

# A session is closed after 30 minutes of inactivity for a given user.
SESSION_GAP = timedelta(minutes=30)

# How much system time to wait after seeing a timestamp before advancing
# the watermark past it. ``0`` is appropriate for batch processing of a
# static file: the window operator will close all remaining windows on
# EOF.
WAIT_FOR_SYSTEM = timedelta(seconds=0)


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _parse_timestamp(raw: str) -> datetime:
    """Parse an ISO 8601 timestamp into a UTC-aware ``datetime``.

    ``datetime.fromisoformat`` only understands the ``Z`` suffix from
    Python 3.11 onwards, so we normalize it to an explicit ``+00:00``
    offset for safety.
    """
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _format_timestamp(value: datetime) -> str:
    """Format a ``datetime`` back to an ISO 8601 string in UTC.

    Uses the trailing ``Z`` suffix to match the format of the input file.
    """
    formatted = value.astimezone(timezone.utc).isoformat()
    if formatted.endswith("+00:00"):
        formatted = formatted[:-6] + "Z"
    return formatted


def parse_event(line: str) -> dict:
    """Parse one JSON line into an event record."""
    event = json.loads(line)
    return {
        "user_id": event["user_id"],
        "event_type": event["event_type"],
        "timestamp": _parse_timestamp(event["timestamp"]),
    }


def to_session_line(item) -> tuple[str, str]:
    """Summarize one closed window into a ``(user_id, json_line)`` tuple.

    The output stream from ``collect_window`` is a keyed stream of
    ``(user_id, (window_id, collected_events))`` items. We pick the
    first/last events in timestamp order (which ``collect_window`` gives
    us by default), compute the requested metrics, and serialize the
    result. The user id is kept as the routing key for the sink.
    """
    user_id, (_window_id, events) = item
    session = {
        "user_id": user_id,
        "session_start": _format_timestamp(events[0]["timestamp"]),
        "session_end": _format_timestamp(events[-1]["timestamp"]),
        "event_count": len(events),
    }
    # ``FileSink`` appends its own newline by default, so we only emit
    # the JSON payload here.
    return user_id, json.dumps(session)


def get_event_timestamp(event: dict) -> datetime:
    return event["timestamp"]


def get_user_id(event: dict) -> str:
    return event["user_id"]


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------

flow = Dataflow("user_event_sessionization")

# 1. Read raw JSON lines from the input file.
events = op.input("events", flow, FileSource(INPUT_PATH))

# 2. Parse each line into a structured event with a ``datetime`` timestamp.
parsed = op.map("parse", events, parse_event)

# 3. Group events by ``user_id`` so each user is processed independently.
keyed = op.key_on("by_user", parsed, get_user_id)

# 4. Drive the windowing by the event timestamp and apply a session
#    windower with a 30 minute inactivity gap.
clock = EventClock(
    ts_getter=get_event_timestamp,
    wait_for_system_duration=WAIT_FOR_SYSTEM,
)
windower = SessionWindower(gap=SESSION_GAP)
windowed = collect_window("session_window", keyed, clock, windower)

# 5. Summarize each closed session and format it as a JSON line.
formatted = op.map("format", windowed.down, to_session_line)

# 6. Write each JSON line to ``sessions.jsonl``.
op.output("sink", formatted, FileSink(OUTPUT_PATH))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Always start from a clean file so re-runs don't append to a stale one.
    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()

    run_main(flow)
