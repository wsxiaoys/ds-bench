"""Bytewax stateful deduplication dataflow.

Reads JSON events from ``input.jsonl`` (one JSON object per line) and writes
the deduplicated events to ``output.jsonl`` (one JSON object per line).

Each input event has the shape::

    {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"}

Events are grouped by ``user_id`` and de-duplicated using a 10-second
sliding window keyed on ``event_id``:

* If the same ``event_id`` is seen again for the same ``user_id`` with
  ``event_timestamp <= previous_timestamp + 10s`` (inclusive), the event is
  dropped.
* If the event arrives strictly more than 10 seconds after the previous
  emitted occurrence, it is emitted and the 10-second window restarts.

In addition, any ``event_id`` whose last emitted timestamp is older than
10 seconds from the current event's timestamp is purged from the state on
every event so the per-user state stays bounded.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.testing import run_main


# 10-second sliding window used for both deduplication and state cleanup.
WINDOW = timedelta(seconds=10)

# Paths are relative to the working directory.
INPUT_PATH = Path("input.jsonl")
OUTPUT_PATH = Path("output.jsonl")


def parse_timestamp(value: str) -> datetime:
    """Parse an ISO 8601 timestamp string (with a trailing ``Z``) into a
    timezone-aware :class:`datetime`.

    :class:`datetime.fromisoformat` only learned to parse the ``Z`` suffix
    in Python 3.11; we translate it manually to stay compatible with older
    interpreters.
    """
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


class DeduplicationLogic(op.StatefulLogic):
    """Stateful deduplication of events per ``user_id``.

    The state kept per key is a mapping ``event_id -> last_emitted_ts``.
    Both the deduplication check and the cleanup pass run on every
    incoming event.
    """

    def __init__(self) -> None:
        # ``event_id`` -> ``datetime`` of the most recent emitted
        # occurrence for the current ``user_id``.
        self._state: Dict[str, datetime] = {}

    def on_item(
        self, value: Dict[str, Any]
    ) -> Tuple[Iterable[Dict[str, Any]], bool]:
        event_id: str = value["event_id"]
        current_ts: datetime = parse_timestamp(value["timestamp"])

        # Cleanup pass: drop state entries whose last emitted timestamp
        # is strictly older than 10 seconds from the current event's
        # timestamp. This keeps the per-user state bounded.
        threshold = current_ts - WINDOW
        if self._state:
            self._state = {
                eid: ts
                for eid, ts in self._state.items()
                if ts >= threshold
            }

        last_ts = self._state.get(event_id)

        # Emit only if this ``event_id`` has never been seen for this
        # user, or if the previous occurrence was strictly more than 10
        # seconds ago. The window boundary is inclusive: an event at
        # ``previous_ts + 10s`` is considered a duplicate and dropped.
        if last_ts is None or current_ts > last_ts + WINDOW:
            self._state[event_id] = current_ts
            return [value], op.StatefulLogic.RETAIN

        # Inside the 10-second window (inclusive): drop.
        return [], op.StatefulLogic.RETAIN

    def on_eof(self) -> Tuple[Iterable[Dict[str, Any]], bool]:
        return [], op.StatefulLogic.DISCARD

    def notify_at(self) -> Optional[datetime]:
        # We don't need scheduled notifications.
        return None

    def snapshot(self) -> Dict[str, datetime]:
        # The state must be effectively immutable for recovery; return a
        # shallow copy so the runtime can pickle it without sharing the
        # live dict.
        return dict(self._state)


def build_logic(
    resume_state: Optional[Dict[str, datetime]]
) -> DeduplicationLogic:
    """Builder called by the ``stateful`` operator for every new key.

    Combines the optional resume state returned from a previous run with
    any non-state configuration (none here) and returns a fresh
    :class:`DeduplicationLogic` instance.
    """
    logic = DeduplicationLogic()
    if resume_state is not None:
        logic._state = dict(resume_state)
    return logic


def parse_line(line: str) -> Optional[Dict[str, Any]]:
    """Parse a single JSON line from the input file.

    Blank lines (which the file source may emit) are filtered out by
    returning ``None``.
    """
    stripped = line.strip()
    if not stripped:
        return None
    return json.loads(stripped)


def to_keyed(event: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """Turn an event dict into a ``(user_id, event)`` tuple."""
    return event["user_id"], event


def to_json_string(keyed: Tuple[str, Dict[str, Any]]) -> Tuple[str, str]:
    """Serialize the event portion of a keyed tuple back to JSON text.

    The downstream :class:`FileSink` expects ``(key, value)`` 2-tuples,
    so we keep the user id as the routing key and use the JSON string
    as the value to write.
    """
    user_id, event = keyed
    return user_id, json.dumps(event)


def build_flow() -> Dataflow:
    """Build and execute the deduplication dataflow."""
    flow = Dataflow("stateful_dedup")

    # 1. Read raw JSON lines from ``input.jsonl``. ``batch_size=1`` makes
    #    the source emit one line per epoch so that the keyed stateful
    #    operator below processes items in input order rather than
    #    re-grouping them per-key inside a single batch.
    inp = op.input(
        "inp", flow, FileSource(str(INPUT_PATH), batch_size=1)
    )

    # 2. Parse the JSON lines into event dicts, dropping any blank lines.
    parsed = op.map("parse_json", inp, parse_line)
    parsed = op.filter("drop_blank", parsed, lambda x: x is not None)

    # 3. Group events by ``user_id`` so the stateful operator sees a
    #    keyed stream.
    keyed = op.map("key_by_user", parsed, to_keyed)

    # 4. Run the stateful deduplication.
    deduped = op.stateful("dedup", keyed, build_logic)

    # 5. Serialize the kept events back to JSON strings.
    json_out = op.map("to_json", deduped, to_json_string)

    # 6. Persist the deduplicated events to ``output.jsonl``.
    op.output("out", json_out, FileSink(OUTPUT_PATH))

    return flow


def main() -> None:
    # Make sure we start from a clean output file even if a previous run
    # produced partial results. The FileSink opens in append-truncate
    # mode, but starting from a known state avoids confusion on re-runs.
    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()

    flow = build_flow()
    run_main(flow)

    # The :class:`FileSink` only creates/truncates the output file when
    # at least one item is written, so make sure an empty input results
    # in an (empty) output file too.
    if not OUTPUT_PATH.exists():
        OUTPUT_PATH.touch()


if __name__ == "__main__":
    main()