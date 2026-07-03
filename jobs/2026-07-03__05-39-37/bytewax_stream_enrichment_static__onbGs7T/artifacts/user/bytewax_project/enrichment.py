"""Stateful stream processing pipeline using Bytewax.

Enriches a stream of transactions with static product metadata and
calculates revenue per category over 1-minute tumbling event-time
windows aligned to the start of the hour.
"""

import json
from datetime import datetime, timedelta, timezone

from bytewax.connectors.files import FileSource
from bytewax.connectors.stdio import StdOutSink
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import EventClock, TumblingWindower, fold_window

# --- Static product metadata, loaded once at initialization ---------------
# `products.json` maps product_id -> {"category": str, "price": number}.
with open("products.json", "r") as _f:
    PRODUCTS = json.load(_f)

# --- Windowing parameters -------------------------------------------------
# 1-minute tumbling windows. Align to the Unix epoch (which is itself on an
# hour boundary) so that minute-long windows also align to the start of
# every hour.
WINDOW_LENGTH = timedelta(minutes=1)
ALIGN_TO = datetime(1970, 1, 1, tzinfo=timezone.utc)


# --- Helpers --------------------------------------------------------------
def parse_transaction(line):
    """Parse a single JSON-lines transaction record."""
    return json.loads(line)


def enrich(txn):
    """Enrich a transaction with category and price.

    Returns ``None`` (so the item is dropped) when the product_id is not
    found in the static product metadata.
    """
    product = PRODUCTS.get(txn["product_id"])
    if product is None:
        return None
    # Parse the ISO-8601 timestamp into a timezone-aware datetime (UTC).
    ts = txn["timestamp"]
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return {
        "category": product["category"],
        "price": product["price"],
        "quantity": txn["quantity"],
        "timestamp": datetime.fromisoformat(ts),
    }


def ts_getter(value):
    """Extract the event-time timestamp used by the EventClock."""
    return value["timestamp"]


def revenue_folder(state, value):
    """Accumulate revenue within a window."""
    return state + value["price"] * value["quantity"]


def revenue_merger(s1, s2):
    """Merge two partial revenue totals (for parallel partitions)."""
    return s1 + s2


def format_output(item):
    """Format an aggregated window result as the required JSON string."""
    category, (window_id, revenue) = item
    # Recover the window start from the window id:
    #   open_time = align_to + length * window_id
    window_start = ALIGN_TO + WINDOW_LENGTH * window_id
    return json.dumps(
        {
            "category": category,
            "window_start": window_start.isoformat(),
            "revenue": revenue,
        }
    )


# --- Dataflow definition --------------------------------------------------
flow = Dataflow("enrichment")

# 1. Ingest the stream of transaction events.
lines = op.input("input", flow, FileSource("transactions.jsonl"))

# 2. Parse each JSON-lines record into a dict.
txns = op.map("parse", lines, parse_transaction)

# 3. Enrich with product metadata; drop unknown products.
enriched = op.filter_map("enrich", txns, enrich)

# 4. Key by category so windowing aggregates per category.
keyed = op.key_on("key_category", enriched, lambda e: e["category"])

# 5. Event-time tumbling window aggregation of revenue.
clock = EventClock(ts_getter, wait_for_system_duration=timedelta(seconds=0))
windower = TumblingWindower(length=WINDOW_LENGTH, align_to=ALIGN_TO)

windowed = fold_window(
    "revenue_window",
    keyed,
    clock,
    windower,
    builder=lambda: 0.0,
    folder=revenue_folder,
    merger=revenue_merger,
)

# 6. Format and write the aggregated results to stdout.
out = op.map("format", windowed.down, format_output)
op.output("stdout", out, StdOutSink())