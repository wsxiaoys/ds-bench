"""Real-time Apdex score calculation with Bytewax.

This script builds a Bytewax dataflow that:

1. Reads JSON events line-by-line from ``input.jsonl``.
2. Groups events by ``service`` into 10-second tumbling windows based on the
   event-time ``timestamp`` field.
3. Computes the Apdex (Application Performance Index) score per
   ``(service, window)`` tuple, using a threshold ``T = 500 ms``:

   - ``response_time_ms <= 500``                -> Satisfied
   - ``500 < response_time_ms <= 2000``         -> Tolerating
   - ``response_time_ms > 2000``                 -> Frustrated

   ``Apdex = (Satisfied + Tolerating / 2) / Total``
4. Writes one JSON object per closed window to ``output.jsonl`` with the
   fields ``window_start`` (ISO 8601), ``service``, and ``apdex_score``
   (float rounded to 2 decimal places).

The script can be invoked as ::

    python apdex_flow.py

It expects ``input.jsonl`` and ``output.jsonl`` to live next to the script
(i.e. in the same directory as ``apdex_flow.py``).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bytewax.dataflow import Dataflow
from bytewax import operators as op
from bytewax.operators.windowing import (
    EventClock,
    TumblingWindower,
    fold_window,
)
from bytewax.connectors.files import FileSource, FileSink
# ``run_main`` lives in the compiled ``_bytewax`` extension (re-exported by
# ``bytewax.testing``). Import it from the public test namespace so we don't
# rely on a private symbol.
from bytewax.testing import run_main


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HERE: Path = Path(__file__).resolve().parent
"""Directory the script lives in - used to resolve relative input/output paths."""

INPUT_PATH: Path = HERE / "input.jsonl"
OUTPUT_PATH: Path = HERE / "output.jsonl"

# Apdex thresholds (milliseconds).
APDEX_THRESHOLD_MS: int = 500          # ``T``
TOLERATING_LIMIT_MS: int = 2000        # ``4 * T`` upper bound for Tolerating

# Windowing configuration.
WINDOW_LENGTH: timedelta = timedelta(seconds=10)
"""Length of each tumbling window."""

# Align windows to the Unix epoch (an arbitrary but stable alignment).  Using a
# fixed epoch makes ``window_start`` deterministic regardless of the data
# ingested.  Any timezone-aware UTC datetime works.
ALIGN_TO: datetime = datetime(1970, 1, 1, tzinfo=timezone.utc)

# How long the event-time clock waits after seeing a timestamp before
# advancing its watermark.  We use zero because our input is a finite
# (offline) file that is read in (essentially) timestamp order, so
# out-of-orderness is not a concern.  Bytewax flushes remaining windows
# at end-of-stream, so the final window is guaranteed to be emitted.
WAIT_FOR_SYSTEM_DURATION: timedelta = timedelta(seconds=0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_iso8601(ts: str) -> datetime:
    """Parse an ISO 8601 timestamp into a timezone-aware ``datetime`` in UTC.

    Accepts the common ``...Z`` suffix as well as offsets such as ``+02:00``.
    """
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        # Assume naive timestamps are in UTC; convert to aware.
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_line(line: str):
    """Parse a single JSON input line.

    Returns a ``(service, response_time_ms, timestamp)`` tuple where
    ``timestamp`` is a timezone-aware ``datetime``.
    """
    obj = json.loads(line)
    return (
        obj["service"],
        int(obj["response_time_ms"]),
        _parse_iso8601(obj["timestamp"]),
    )


class ApdexAccumulator:
    """Mutable window accumulator tracking the three Apdex category counts.

    The ``service`` field is captured lazily on the first value seen
    (using the keyed value).  It is later read by the output step to
    emit the per-window JSON line.  Because each (key, window) pair
    receives a *fresh* accumulator from ``builder`` and the same key
    value is always associated with the same key, this is safe.

    ``TumblingWindower`` never triggers a merge, but ``_merger`` is still
    provided so the dataflow remains valid for any windower swap.
    """

    __slots__ = ("service", "satisfied", "tolerating", "frustrated")

    def __init__(self) -> None:
        self.service: str | None = None
        self.satisfied: int = 0
        self.tolerating: int = 0
        self.frustrated: int = 0

    def add(self, value) -> "ApdexAccumulator":
        """Fold a single keyed value (``(service, rt_ms, ts)``) into the state."""
        if self.service is None:
            self.service = value[0]
        response_time_ms = value[1]
        if response_time_ms <= APDEX_THRESHOLD_MS:
            self.satisfied += 1
        elif response_time_ms <= TOLERATING_LIMIT_MS:
            self.tolerating += 1
        else:
            self.frustrated += 1
        return self

    def merge(self, other: "ApdexAccumulator") -> "ApdexAccumulator":
        """Merge another accumulator into this one (unused for tumbling)."""
        if self.service is None:
            self.service = other.service
        self.satisfied += other.satisfied
        self.tolerating += other.tolerating
        self.frustrated += other.frustrated
        return self

    def score(self) -> float:
        """Return the Apdex score, rounded to 2 decimal places at call-site."""
        total = self.satisfied + self.tolerating + self.frustrated
        if total == 0:
            return 0.0
        return (self.satisfied + self.tolerating / 2) / total


def _build() -> ApdexAccumulator:
    """Builder for ``fold_window``: returns a fresh empty accumulator."""
    return ApdexAccumulator()


def _folder(
    acc: ApdexAccumulator, value
) -> ApdexAccumulator:
    """Fold a single keyed value into the accumulator in place."""
    return acc.add(value)


def _merger(
    a: ApdexAccumulator, b: ApdexAccumulator
) -> ApdexAccumulator:
    """Combine two accumulators (unused for ``TumblingWindower``)."""
    return a.merge(b)


def _window_start(window_id: int) -> datetime:
    """Compute the open (start) time of a tumbling window.

    Mirrors the formula used inside Bytewax's ``_SlidingWindowerLogic``
    so the result is exactly the ``open_time`` that the windower would
    have recorded on the ``WindowMetadata``.
    """
    return ALIGN_TO + WINDOW_LENGTH * window_id


def _format_value(payload) -> str:
    """Format a closed window's payload as a single JSON-encoded line.

    ``payload`` is the ``(window_id, accumulator)`` tuple emitted on
    ``WindowOut.down``.  The accumulator carries the captured
    ``service`` name so the resulting JSON line is self-contained.
    """
    window_id, acc = payload
    return json.dumps(
        {
            "window_start": _window_start(window_id).isoformat(),
            "service": acc.service,
            "apdex_score": round(acc.score(), 2),
        },
        separators=(", ", ": "),
    )


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------


def build_flow() -> Dataflow:
    """Construct and return the Apdex dataflow (without running it)."""
    flow = Dataflow("apdex_calculator")

    # 1. Source: line-by-line reader for ``input.jsonl``.
    lines = op.input(
        "input",
        flow,
        FileSource(str(INPUT_PATH)),
    )

    # 2. Parse each JSON line into ``(service, response_time_ms, datetime)``.
    parsed = op.map("parse", lines, _parse_line)

    # 3. Key by ``service`` so each service is windowed independently.
    keyed = op.key_on("key_by_service", parsed, lambda x: x[0])

    # 4. Configure event-time windowing.
    clock = EventClock(
        ts_getter=lambda x: x[2],
        wait_for_system_duration=WAIT_FOR_SYSTEM_DURATION,
    )
    windower = TumblingWindower(
        length=WINDOW_LENGTH,
        align_to=ALIGN_TO,
    )

    # 5. Fold each (key, window) into an ``ApdexAccumulator``.
    windowed = fold_window(
        "apdex_window",
        keyed,
        clock,
        windower,
        builder=_build,
        folder=_folder,
        merger=_merger,
    )

    # 6. Format each closed window to a JSON line.  ``map_value`` keeps
    #    the keyed shape ``(service, value)`` which is required by the
    #    ``FixedPartitionedSink`` (``FileSink``).
    formatted = op.map_value("format_output", windowed.down, _format_value)

    # 7. Sink: write each JSON line to ``output.jsonl``.  ``FileSink``
    #    requires the file to exist, so make sure it does before we
    #    hand the sink to the runtime.
    OUTPUT_PATH.touch(exist_ok=True)
    op.output("output", formatted, FileSink(OUTPUT_PATH))

    return flow


def main() -> None:
    """Entry point: build and run the dataflow."""
    flow = build_flow()
    run_main(flow)


if __name__ == "__main__":
    main()
