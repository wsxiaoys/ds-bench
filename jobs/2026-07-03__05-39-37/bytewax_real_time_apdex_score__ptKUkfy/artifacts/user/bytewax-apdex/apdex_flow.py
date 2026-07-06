"""Real-Time Apdex Score Calculation with Bytewax.

This dataflow reads JSON-lines performance metrics from ``input.jsonl``,
calculates the Apdex (Application Performance Index) score per service
in 10-second tumbling windows based on event time, and writes the
results to ``output.jsonl``.

Apdex threshold T = 500 ms:
    Satisfied   : response_time_ms <= 500
    Tolerating  : 500 < response_time_ms <= 2000
    Frustrated  : response_time_ms > 2000

Apdex formula: (Satisfied + Tolerating / 2) / Total

Run directly::

    python apdex_flow.py
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Tuple

from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import EventClock, TumblingWindower, fold_window
from bytewax.testing import run_main

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
INPUT_PATH = SCRIPT_DIR / "input.jsonl"
OUTPUT_PATH = SCRIPT_DIR / "output.jsonl"

APDEX_THRESHOLD = 500       # ms — "satisfied" upper bound
TOLERATING_THRESHOLD = 2000  # ms — "tolerating" upper bound
WINDOW_LENGTH = timedelta(seconds=10)
# Align windows to the Unix epoch so boundaries fall on 10-second marks.
ALIGN_TO = datetime(1970, 1, 1, tzinfo=timezone.utc)

# Accumulator type: (satisfied_count, tolerating_count, total_count)
Accum = Tuple[int, int, int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_line(line: str) -> Dict:
    """Parse a JSON line into a metric dict."""
    return json.loads(line)


def extract_timestamp(item: Dict) -> datetime:
    """Extract an aware UTC datetime from the ``timestamp`` field."""
    ts = item["timestamp"]
    # Python 3.11+ handles 'Z', but replace defensively for older
    # runtimes or non-Z-aware fromisoformat implementations.
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def accumulator_builder() -> Accum:
    """Build an empty accumulator for a new window."""
    return (0, 0, 0)


def folder(acc: Accum, item: Dict) -> Accum:
    """Fold a metric into the accumulator."""
    satisfied, tolerating, total = acc
    rt = item["response_time_ms"]
    if rt <= APDEX_THRESHOLD:
        satisfied += 1
    elif rt <= TOLERATING_THRESHOLD:
        tolerating += 1
    # Items above TOLERATING_THRESHOLD are "frustrated" and only
    # contribute to the total count.
    total += 1
    return (satisfied, tolerating, total)


def merger(a: Accum, b: Accum) -> Accum:
    """Merge two accumulators (used when windows merge)."""
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def format_output(item: Tuple[str, Tuple[int, Accum]]) -> Tuple[str, str]:
    """Format a windowed result as a ``(key, json_line)`` pair for output.

    ``item`` is ``(service, (window_id, (satisfied, tolerating, total)))``.
    The window start time is derived from the window ID and the
    ``align_to`` / ``length`` configuration of the TumblingWindower.

    Returns a ``(service, json_string)`` tuple. The service name acts
    as the routing key for the ``FileSink``; the JSON string is the
    value that gets written to disk.
    """
    service, (window_id, state) = item
    satisfied, tolerating, total = state
    if total > 0:
        apdex = (satisfied + tolerating / 2) / total
    else:
        apdex = 0.0
    window_start = ALIGN_TO + WINDOW_LENGTH * window_id
    line = json.dumps(
        {
            "window_start": window_start.isoformat(),
            "service": service,
            "apdex_score": round(apdex, 2),
        }
    )
    return (service, line)


# ---------------------------------------------------------------------------
# Dataflow definition
# ---------------------------------------------------------------------------

flow = Dataflow("apdex")

# 1. Read JSON lines from the input file
lines = op.input("input", flow, FileSource(INPUT_PATH))

# 2. Parse each line into a dict
parsed = op.map("parse", lines, parse_line)

# 3. Key the stream by service name
keyed = op.key_on("key_on", parsed, lambda item: item["service"])

# 4. Event clock — use the embedded timestamp for watermarking
clock = EventClock(
    ts_getter=extract_timestamp,
    wait_for_system_duration=timedelta(seconds=0),
)

# 5. Tumbling window — 10-second windows aligned to the epoch
windower = TumblingWindower(
    length=WINDOW_LENGTH,
    align_to=ALIGN_TO,
)

# 6. Fold per-service counts within each window
windowed = fold_window(
    "fold_window",
    keyed,
    clock,
    windower,
    builder=accumulator_builder,
    folder=folder,
    merger=merger,
)

# 7. Format each closed window as a JSON line
formatted = op.map("format", windowed.down, format_output)

# 8. Write results to the output file
op.output("output", formatted, FileSink(OUTPUT_PATH))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_main(flow)