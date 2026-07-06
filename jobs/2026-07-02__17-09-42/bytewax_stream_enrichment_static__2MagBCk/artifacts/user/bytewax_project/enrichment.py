"""Stateful stream processing pipeline.

Reads product metadata from ``products.json`` at module import time and
joins a stream of transactions ingested from ``transactions.jsonl``
with that metadata. Each enriched transaction is keyed by product
``category`` and aggregated into 1-minute tumbling event-time windows
so we can report total revenue per category per window.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bytewax.connectors.files import FileSource
from bytewax.connectors.stdio import StdOutSink
from bytewax.dataflow import Dataflow
from bytewax.operators.windowing import (
    EventClock,
    TumblingWindower,
    fold_window,
)
from bytewax import operators as op


# ---------------------------------------------------------------------------
# Load static product metadata at initialization
# ---------------------------------------------------------------------------
PRODUCTS_FILE = Path("products.json")
TRANSACTIONS_FILE = Path("transactions.jsonl")


with PRODUCTS_FILE.open("r") as _f:
    PRODUCTS: dict[str, dict] = json.load(_f)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def _parse_dt(ts: str) -> datetime:
    """Parse an ISO-8601 timestamp string into a timezone-aware ``datetime``.

    The incoming timestamps use a trailing ``Z`` which ``fromisoformat``
    only accepts on Python 3.11+. Replace it with ``+00:00`` so the code
    works on any supported Python version.
    """
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _line_to_dict(line: str) -> dict:
    """Parse a single JSONL line into a Python ``dict``."""
    return json.loads(line)


def _enrich(tx: dict) -> dict | None:
    """Enrich a transaction with ``category``, ``price`` and ``revenue``.

    Returns ``None`` if the product is not in the metadata, which makes
    this suitable for use with :func:`bytewax.operators.filter_map`.

    The 1-minute tumbling window aligns to minute boundaries, so every
    event in the same window shares the same ``window_start``. We
    pre-compute it here so the window operator can carry it forward
    through the fold.
    """
    product = PRODUCTS.get(tx["product_id"])
    if product is None:
        return None
    event_time = _parse_dt(tx["timestamp"])
    return {
        "category": product["category"],
        "revenue": product["price"] * tx["quantity"],
        "event_time": event_time,
        "window_start": event_time.replace(second=0, microsecond=0),
    }


def _folder(acc: tuple[datetime, float], new: dict) -> tuple[datetime, float]:
    """Add a new event's revenue to the running per-window total.

    The accumulator is ``(window_start, total_revenue)``. The very first
    call receives the seed value built by the ``builder`` lambda, so we
    adopt the incoming event's ``window_start`` rather than the seed.
    Every subsequent event in the window has the same ``window_start``
    so this keeps the value stable for the lifetime of the window.
    """
    _, total = acc
    return new["window_start"], total + new["revenue"]


def _merger(
    a: tuple[datetime, float], b: tuple[datetime, float]
) -> tuple[datetime, float]:
    """Merge two windows of the same key (used for late events)."""
    ws_a, total_a = a
    ws_b, total_b = b
    # For a tumbling window both sides refer to the same window, so
    # pick whichever side isn't still holding the seed datetime.
    if ws_a.year > 1970:
        return ws_a, total_a + total_b
    return ws_b, total_a + total_b


def _format_output(item: tuple) -> str:
    """Format the ``(key, (wid, value))`` tuple emitted by ``fold_window``."""
    category, (_wid, (window_start, revenue)) = item
    payload = {
        "category": category,
        "window_start": window_start.isoformat().replace("+00:00", "Z"),
        "revenue": revenue,
    }
    return json.dumps(payload)


# ---------------------------------------------------------------------------
# Build the dataflow
# ---------------------------------------------------------------------------
def _build_flow() -> Dataflow:
    flow = Dataflow("enrichment")

    # Read transactions line-by-line and parse each line.
    lines = op.input("transactions", flow, FileSource(str(TRANSACTIONS_FILE)))
    parsed = op.flat_map_batch(
        "parse_lines", lines, lambda batch: map(_line_to_dict, batch)
    )

    # Enrich with product metadata; drop transactions referencing
    # unknown products.
    enriched = op.filter_map("enrich", parsed, _enrich)

    # Key the stream by category so the window is per-category.
    keyed = op.key_on("by_category", enriched, lambda x: x["category"])

    # Define the event-time clock.
    clock = EventClock(
        ts_getter=lambda x: x["event_time"],
        wait_for_system_duration=timedelta(seconds=10),
    )

    # 1-minute tumbling window aligned to the epoch, i.e. to the start
    # of every minute (so the very first window starts at the start of
    # the hour that contains the epoch).
    windower = TumblingWindower(
        length=timedelta(minutes=1),
        align_to=datetime(1970, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
    )

    windowed = fold_window(
        "sum_revenue",
        keyed,
        clock,
        windower,
        builder=lambda: (datetime(1970, 1, 1, tzinfo=timezone.utc), 0.0),
        folder=_folder,
        merger=_merger,
    )

    # The windowed stream yields ``(category, (wid, (window_start,
    # total_revenue)))``. Format each tuple as the JSON payload the
    # task requires and write it to stdout.
    formatted = op.map("format", windowed.down, _format_output)
    op.output("stdout", formatted, StdOutSink())

    return flow


flow = _build_flow()
