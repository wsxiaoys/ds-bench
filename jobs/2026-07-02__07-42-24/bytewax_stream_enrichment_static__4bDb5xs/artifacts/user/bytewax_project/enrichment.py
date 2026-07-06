import os
import json
from datetime import datetime, timedelta, timezone
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import TumblingWindower, EventClock, fold_window
from bytewax.connectors.files import FileSource
from bytewax.connectors.stdio import StdOutSink

# Load static dataset of product metadata
dir_path = os.path.dirname(os.path.abspath(__file__))
products_path = os.path.join(dir_path, "products.json")
with open(products_path, "r") as f:
    products = json.load(f)

transactions_path = os.path.join(dir_path, "transactions.jsonl")

# Define Bytewax flow
flow = Dataflow("enrichment_flow")

# Ingest transactions
transactions_stream = op.input("input_transactions", flow, FileSource(transactions_path))

# Parse and enrich transactions, dropping those not in products.json
def enrich_transaction(line):
    try:
        tx = json.loads(line)
    except Exception:
        return None
    
    product_id = tx.get("product_id")
    if not product_id or product_id not in products:
        return None
    
    prod_meta = products[product_id]
    tx["category"] = prod_meta["category"]
    tx["price"] = prod_meta["price"]
    # Parse timestamp into timezone-aware datetime
    tx["parsed_timestamp"] = datetime.fromisoformat(tx["timestamp"])
    return tx

enriched_stream = op.filter_map("enrich", transactions_stream, enrich_transaction)

# Key the stream by category
keyed_stream = op.key_on("key_by_category", enriched_stream, lambda tx: tx["category"])

# Define EventClock based on parsed_timestamp
def get_tx_timestamp(tx):
    return tx["parsed_timestamp"]

clock = EventClock(
    ts_getter=get_tx_timestamp,
    wait_for_system_duration=timedelta(seconds=0)
)

# Define TumblingWindower aligned to the start of the hour
# We can use 1970-01-01 00:00:00 UTC as our base alignment, which is an hour boundary.
windower = TumblingWindower(
    length=timedelta(minutes=1),
    align_to=datetime(1970, 1, 1, 0, 0, tzinfo=timezone.utc)
)

# Group and aggregate total revenue (price * quantity) using tumbling window
windowed = fold_window(
    "window_aggregation",
    keyed_stream,
    clock,
    windower,
    builder=lambda: 0.0,
    folder=lambda acc, tx: acc + (tx["price"] * tx["quantity"]),
    merger=lambda a, b: a + b
)

# Re-key down (results) and meta streams to f"{category}-{window_id}" to join them
keyed_down = op.map("key_down", windowed.down, lambda x: (f"{x[0]}-{x[1][0]}", (x[0], x[1][1])))
keyed_meta = op.map("key_meta", windowed.meta, lambda x: (f"{x[0]}-{x[1][0]}", x[1][1]))

# Join down and meta streams
joined = op.join("join_results_and_meta", keyed_down, keyed_meta)

# Format the joined result to JSON string
def format_output(joined_item):
    new_key, ((category, revenue), meta) = joined_item
    window_start = meta.open_time.isoformat()
    return json.dumps({
        "category": category,
        "window_start": window_start,
        "revenue": revenue
    })

formatted_output = op.map("format_output", joined, format_output)

# Output to standard output
op.output("stdout_out", formatted_output, StdOutSink())
