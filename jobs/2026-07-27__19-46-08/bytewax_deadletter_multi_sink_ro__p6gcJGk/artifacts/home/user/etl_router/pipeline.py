"""ETL Router pipeline using Bytewax.

Reads a JSONL file, validates/normalizes records, routes valid records
to per-category output files, sends invalid records to a dead-letter file,
and writes a run summary.
"""

import json
import os
from typing import Any, Dict, List, Optional, Tuple

from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink
from bytewax.outputs import DynamicSink, StatelessSinkPartition
import bytewax.operators as op

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_CATEGORIES = {"orders", "payments", "refunds"}
ALLOWED_CATEGORIES_ORDERED = ["orders", "payments", "refunds"]
ALLOWED_CURRENCIES = {"USD", "EUR", "GBP"}
REQUIRED_FIELDS = ["id", "category", "amount", "currency"]

INPUT_PATH = os.path.join(os.path.dirname(__file__), "data", "input.jsonl")
OUT_DIR = os.path.join(os.path.dirname(__file__), "out")


# ---------------------------------------------------------------------------
# Classification / validation
# ---------------------------------------------------------------------------


def classify_record(
    line_number: int, raw: str
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Classify a raw input line.

    Returns a tuple of (valid_record, dead_letter_record).
    Exactly one will be non-None.
    """
    # Rule 1: Must parse as JSON object
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None, _dead_letter(raw, line_number, "malformed_json")

    if not isinstance(parsed, dict):
        return None, _dead_letter(raw, line_number, "malformed_json")

    # Rule 2: Required fields present (checked in order)
    for field in REQUIRED_FIELDS:
        if field not in parsed:
            return None, _dead_letter(raw, line_number, f"missing_field:{field}")

    # Rule 3: Field types (checked in order)
    # id: string or integer (not boolean)
    id_val = parsed["id"]
    if isinstance(id_val, bool) or not isinstance(id_val, (str, int)):
        return None, _dead_letter(raw, line_number, "invalid_type:id")

    # category: string
    category_val = parsed["category"]
    if not isinstance(category_val, str):
        return None, _dead_letter(raw, line_number, "invalid_type:category")

    # amount: number (int or float, not bool)
    amount_val = parsed["amount"]
    if isinstance(amount_val, bool) or not isinstance(amount_val, (int, float)):
        return None, _dead_letter(raw, line_number, "invalid_type:amount")

    # currency: string
    currency_val = parsed["currency"]
    if not isinstance(currency_val, str):
        return None, _dead_letter(raw, line_number, "invalid_type:currency")

    # Rule 4: category must be allowed
    if category_val not in ALLOWED_CATEGORIES:
        return None, _dead_letter(
            raw, line_number, f"unknown_category:{category_val}"
        )

    # Rule 5: amount must be positive
    if amount_val <= 0:
        return None, _dead_letter(raw, line_number, "invalid_amount:non_positive")

    # Rule 6: currency must be allowed
    if currency_val not in ALLOWED_CURRENCIES:
        return None, _dead_letter(
            raw, line_number, f"invalid_currency:{currency_val}"
        )

    # Valid record — normalize
    normalized = {
        "id": str(id_val),
        "category": category_val,
        "amount_cents": round(amount_val * 100),
        "currency": currency_val,
    }
    return normalized, None


def _dead_letter(raw: str, line_number: int, error: str) -> Dict[str, Any]:
    """Build a dead-letter record."""
    return {
        "raw": raw,
        "error": error,
        "line": line_number,
    }


# ---------------------------------------------------------------------------
# Custom sinks for collecting records (used for metrics aggregation)
# ---------------------------------------------------------------------------


class _SharedListPartition(StatelessSinkPartition[Dict[str, Any]]):
    """Partition that appends items to a shared list."""

    def __init__(self, collector: List[Dict[str, Any]]):
        self._collector = collector

    def write_batch(self, items: List[Dict[str, Any]]) -> None:
        self._collector.extend(items)

    def close(self) -> None:
        pass


class CollectingSink(DynamicSink[Dict[str, Any]]):
    """A DynamicSink that collects all written items into a shared list."""

    def __init__(self, collector: List[Dict[str, Any]]):
        self._collector = collector

    def build(
        self, step_id: str, worker_index: int, worker_count: int
    ) -> StatelessSinkPartition:
        return _SharedListPartition(self._collector)


# Module-level collectors for single-worker execution
_valid_records: List[Dict[str, Any]] = []
_dead_records: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Write output files (called after dataflow completes)
# ---------------------------------------------------------------------------


def write_outputs():
    """Write all output files after the dataflow completes."""
    os.makedirs(OUT_DIR, exist_ok=True)

    # Group valid records by category (preserving input order)
    by_category: Dict[str, List[Dict[str, Any]]] = {
        cat: [] for cat in ALLOWED_CATEGORIES_ORDERED
    }
    for rec in _valid_records:
        by_category[rec["category"]].append(rec)

    # Write per-category files
    for cat in ALLOWED_CATEGORIES_ORDERED:
        path = os.path.join(OUT_DIR, f"{cat}.jsonl")
        with open(path, "w") as f:
            for rec in by_category[cat]:
                f.write(json.dumps(rec, separators=(",", ":")) + "\n")

    # Write dead-letter file
    dl_path = os.path.join(OUT_DIR, "dead_letter.jsonl")
    with open(dl_path, "w") as f:
        for rec in _dead_records:
            f.write(json.dumps(rec, separators=(",", ":")) + "\n")

    # Compute metrics
    total = len(_valid_records) + len(_dead_records)
    valid_count = len(_valid_records)
    dead_count = len(_dead_records)

    by_category_counts = {cat: len(by_category[cat]) for cat in ALLOWED_CATEGORIES_ORDERED}

    by_error: Dict[str, int] = {}
    for rec in _dead_records:
        err = rec["error"]
        by_error[err] = by_error.get(err, 0) + 1
    # Sort by_error keys for deterministic output
    by_error = dict(sorted(by_error.items()))

    metrics = {
        "total": total,
        "valid": valid_count,
        "dead_letter": dead_count,
        "by_category": by_category_counts,
        "by_error": by_error,
    }

    metrics_path = os.path.join(OUT_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        f.write(json.dumps(metrics, separators=(",", ":")) + "\n")


# ---------------------------------------------------------------------------
# Dataflow definition
# ---------------------------------------------------------------------------

flow = Dataflow("etl_router")

# Step 1: Read input lines from file
lines = op.input("read_input", flow, FileSource(INPUT_PATH, batch_size=1))

# Step 2: Assign line numbers.
# We key everything under a constant key and use stateful_map to maintain
# a monotonically increasing line counter.
keyed_lines = op.key_on("single_key", lines, lambda _: "all")


def add_line_number(
    state: Optional[int], line: str
) -> Tuple[Optional[int], Tuple[int, str]]:
    """Attach a line number to each line, starting at 1."""
    if state is None:
        state = 1
    result = (state, line)
    return (state + 1, result)


numbered = op.stateful_map("number_lines", keyed_lines, add_line_number)

# Drop the key, keep (line_number, raw_line)
unnumbered = op.map("drop_key", numbered, lambda kv: kv[1])

# Step 3: Classify each record into (valid_record, dead_record)
classified = op.map(
    "classify",
    unnumbered,
    lambda tup: classify_record(tup[0], tup[1]),
)

# Step 4: Branch into valid and dead-letter streams
branch_out = op.branch(
    "split_valid_dead",
    classified,
    lambda tup: tup[0] is not None,
)

# Extract the actual record from the tuple
valid_stream = op.map("extract_valid", branch_out.trues, lambda tup: tup[0])
dead_stream = op.map("extract_dead", branch_out.falses, lambda tup: tup[1])

# Step 5: Route valid records to per-category sinks

# Branch by category (three-way split using two binary branches)
cat_split = op.branch(
    "is_orders",
    valid_stream,
    lambda r: r["category"] == "orders",
)
orders_stream = cat_split.trues

cat_split2 = op.branch(
    "is_payments",
    cat_split.falses,
    lambda r: r["category"] == "payments",
)
payments_stream = cat_split2.trues
refunds_stream = cat_split2.falses

# Serialize to JSON strings
def to_json(rec: Dict[str, Any]) -> str:
    return json.dumps(rec, separators=(",", ":"))


orders_json = op.map("orders_to_json", orders_stream, to_json)
payments_json = op.map("payments_to_json", payments_stream, to_json)
refunds_json = op.map("refunds_to_json", refunds_stream, to_json)
dead_json = op.map("dead_to_json", dead_stream, to_json)

# Key the JSON strings for FileSink (FileSink requires a keyed stream)
orders_keyed = op.key_on("key_orders", orders_json, lambda _: "orders")
payments_keyed = op.key_on("key_payments", payments_json, lambda _: "payments")
refunds_keyed = op.key_on("key_refunds", refunds_json, lambda _: "refunds")
dead_keyed = op.key_on("key_dead", dead_json, lambda _: "dead")

# Write to FileSink instances
op.output("sink_orders", orders_keyed, FileSink(os.path.join(OUT_DIR, "orders.jsonl")))
op.output("sink_payments", payments_keyed, FileSink(os.path.join(OUT_DIR, "payments.jsonl")))
op.output("sink_refunds", refunds_keyed, FileSink(os.path.join(OUT_DIR, "refunds.jsonl")))
op.output("sink_dead", dead_keyed, FileSink(os.path.join(OUT_DIR, "dead_letter.jsonl")))

# Step 6: Collect records for metrics aggregation
op.output("collect_valid", valid_stream, CollectingSink(_valid_records))
op.output("collect_dead", dead_stream, CollectingSink(_dead_records))


# ---------------------------------------------------------------------------
# Post-run hook: write metrics after dataflow completes
# ---------------------------------------------------------------------------

def _post_run():
    """Called after the dataflow completes to write metrics."""
    write_outputs()


# Register the post-run hook via atexit so it runs after bytewax.run finishes
import atexit
atexit.register(_post_run)
