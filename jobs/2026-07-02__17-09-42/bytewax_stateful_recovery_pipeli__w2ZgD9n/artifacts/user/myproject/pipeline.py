"""Sliding-window temperature statistics dataflow.

Reads newline-delimited JSON sensor readings from ``input.jsonl``,
groups them into 60-second sliding windows (30-second step) aligned to
``2026-01-01T00:00:00Z`` per ``sensor_id``, and writes the mean and
population standard deviation of the temperatures to ``output.jsonl``.

The dataflow is intentionally built out of ordinary module-level
functions (no lambdas, no locally-defined callables) and pure-Python
immutable tuples for accumulator state, so that it can be safely
pickled by Bytewax's SQLite-backed recovery mechanism.

The dataflow object is exposed as ``flow`` so it can be executed with::

    python -m bytewax.run pipeline:flow \\
        -r ./recovery_dir -s 1 -b 0
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import (
    EventClock,
    SlidingWindower,
    fold_window,
)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Paths are resolved relative to this module so the pipeline behaves the
# same regardless of the current working directory of the launcher.
BASE_DIR = Path(__file__).resolve().parent

INPUT_PATH = str(BASE_DIR / "input.jsonl")
OUTPUT_PATH = str(BASE_DIR / "output.jsonl")

# Window parameters.
WINDOW_LENGTH = timedelta(seconds=60)
WINDOW_OFFSET = timedelta(seconds=30)
ALIGN_TO = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Stage functions (module-level so they are picklable for recovery).
# ---------------------------------------------------------------------------


def parse_line(line: str) -> dict:
    """Parse a JSON input line into a dict with parsed ``time``.

    The raw input has ``sensor_id`` (string), ``time`` (ISO8601 string),
    and ``temp`` (number). We parse the timestamp eagerly into a
    timezone-aware :class:`datetime` in UTC and attach it under the
    ``_event_time`` key so downstream stages don't need to repeat the
    work.
    """
    record = json.loads(line)
    raw_time = record["time"]
    if isinstance(raw_time, str):
        normalized = raw_time[:-1] + "+00:00" if raw_time.endswith("Z") else raw_time
        event_time = datetime.fromisoformat(normalized)
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        else:
            event_time = event_time.astimezone(timezone.utc)
    else:  # pragma: no cover - input spec says ISO8601 string
        event_time = raw_time
    record["_event_time"] = event_time
    return record


def get_event_time(record: dict) -> datetime:
    """Return the event-time for :class:`EventClock`."""
    return record["_event_time"]


def key_by_sensor(record: dict) -> str:
    """Key stream items by ``sensor_id``. Keys must be strings."""
    return str(record["sensor_id"])


def accumulator_builder():
    """Build the picklable initial accumulator ``(count, sum, sum_sq)``."""
    return (0, 0.0, 0.0)


def accumulator_folder(state, record):
    """Fold a new temperature reading into the running aggregate.

    ``state`` is a 3-tuple ``(count, sum, sum_sq)``. ``record`` is the
    parsed dict from :func:`parse_line`. We return a brand new tuple
    rather than mutating the input, which keeps the state fully
    immutable and trivially picklable.
    """
    count, sum_, sum_sq = state
    temp = float(record["temp"])
    return (count + 1, sum_ + temp, sum_sq + temp * temp)


def accumulator_merger(state_a, state_b):
    """Merge two partial accumulators from the same window."""
    return (
        state_a[0] + state_b[0],
        state_a[1] + state_b[1],
        state_a[2] + state_b[2],
    )


def render_window(item):
    """Render a windowed event ``(sensor_id, (window_id, state))`` to JSON.

    For ``SlidingWindower`` with ``align_to=A``, ``length=L``,
    ``offset=O`` the window with id ``n`` covers
    ``[A + n*O, A + n*O + L)`` -- which we use to derive the
    ``window_start`` / ``window_end`` timestamps without having to
    re-join against the ``meta`` stream.

    :arg item: ``(sensor_id, (window_id, state))`` 2-tuple from
        :attr:`WindowOut.down`.

    :returns: ``(sensor_id, json_line)`` -- still keyed on
        ``sensor_id`` so that the downstream :class:`FileSink` only
        writes the JSON value to disk. No trailing newline; ``FileSink``
        appends the configured end token (default newline).
    """
    sensor_id, window_id_state = item
    window_id, state = window_id_state
    count, sum_, sum_sq = state

    if count > 0:
        mean = sum_ / count
        # Population variance: E[X^2] - E[X]^2. Clamp at 0 to absorb
        # tiny negative values from floating-point round-off before
        # passing to ``sqrt``.
        variance = sum_sq / count - mean * mean
        stddev = math.sqrt(variance if variance > 0.0 else 0.0)
    else:
        mean = 0.0
        stddev = 0.0

    window_start = ALIGN_TO + WINDOW_OFFSET * window_id
    window_end = window_start + WINDOW_LENGTH

    json_line = json.dumps(
        {
            "sensor_id": sensor_id,
            "window_start": window_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "window_end": window_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "mean": mean,
            "stddev": stddev,
        },
        sort_keys=False,
    )
    return sensor_id, json_line


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------


flow = Dataflow("sliding_window_outlier")

inp = op.input("input", flow, FileSource(INPUT_PATH))
parsed = op.map("parse", inp, parse_line)
keyed = op.key_on("key_by_sensor", parsed, key_by_sensor)

clock = EventClock(
    ts_getter=get_event_time,
    wait_for_system_duration=timedelta(0),
)

windower = SlidingWindower(
    length=WINDOW_LENGTH,
    offset=WINDOW_OFFSET,
    align_to=ALIGN_TO,
)

windowed = fold_window(
    "fold_window",
    keyed,
    clock,
    windower,
    builder=accumulator_builder,
    folder=accumulator_folder,
    merger=accumulator_merger,
)

# Each keyed stream item is ``(sensor_id, (window_id, state))``. We
# turn it into ``(sensor_id, json_string)`` so the downstream
# ``FileSink`` can route by key and write only the JSON value.
formatted = op.map("format", windowed.down, render_window)

op.output("output", formatted, FileSink(OUTPUT_PATH))


if __name__ == "__main__":  # pragma: no cover - convenience entry point
    from bytewax.run import cli_main

    cli_main()
