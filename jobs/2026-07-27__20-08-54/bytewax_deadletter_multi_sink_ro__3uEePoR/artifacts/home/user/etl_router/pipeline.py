"""
Streaming ETL router with dead-letter sink, built with Bytewax.

Reads `data/input.jsonl` line by line (in file order), classifies and
normalizes each record, routes valid records to per-category output
files, sends invalid records to a dead-letter file, and finally emits
an aggregate metrics summary.
"""

import json
import os
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional, Tuple

from bytewax.dataflow import Dataflow
from bytewax.inputs import DynamicSource, StatelessSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition
import bytewax.operators as op

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(PROJECT_DIR, "data", "input.jsonl")
OUT_DIR = os.path.join(PROJECT_DIR, "out")

ALLOWED_CATEGORIES = ("orders", "payments", "refunds")
ALLOWED_CURRENCIES = ("USD", "EUR", "GBP")
REQUIRED_FIELDS = ("id", "category", "amount", "currency")


# ---------------------------------------------------------------------------
# Input: read the file line by line, preserving 1-based line numbers and
# input order. Single, deterministic partition so re-runs are identical.
# ---------------------------------------------------------------------------
class _LinePartition(StatelessSourcePartition):
    def __init__(self, path: str, active: bool) -> None:
        self._items: List[Tuple[int, str]] = []
        if active and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            self._items = list(enumerate(content.splitlines(), start=1))
        self._idx = 0

    def next_batch(self) -> List[Tuple[int, str]]:
        if self._idx >= len(self._items):
            raise StopIteration
        batch = self._items[self._idx :]
        self._idx = len(self._items)
        return batch


class LineFileSource(DynamicSource):
    def __init__(self, path: str) -> None:
        self._path = path

    def build(
        self, step_id: str, worker_index: int, worker_count: int
    ) -> StatelessSourcePartition:
        # Only worker 0 reads the file so the file is processed exactly
        # once, in order, regardless of worker count.
        return _LinePartition(self._path, active=worker_index == 0)


# ---------------------------------------------------------------------------
# Output: append pre-serialized text lines to a single file. The file is
# (re)created fresh on every run so the pipeline is repeatable.
# ---------------------------------------------------------------------------
class _LinesSinkPartition(StatelessSinkPartition):
    def __init__(self, path: str, active: bool) -> None:
        self._active = active
        self._f = None
        if self._active:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            self._f = open(path, "w", encoding="utf-8")

    def write_batch(self, items: List[str]) -> None:
        if not self._active or self._f is None:
            return
        for item in items:
            self._f.write(item)
            self._f.write("\n")
        self._f.flush()

    def close(self) -> None:
        if self._f is not None:
            self._f.close()
            self._f = None


class LinesFileSink(DynamicSink):
    def __init__(self, path: str) -> None:
        self._path = path

    def build(
        self, step_id: str, worker_index: int, worker_count: int
    ) -> StatelessSinkPartition:
        return _LinesSinkPartition(self._path, active=worker_index == 0)


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------
def _is_valid_id(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    return isinstance(value, (str, int))


def _is_valid_amount(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    return isinstance(value, (int, float))


def _amount_to_cents(amount: Any) -> int:
    # Use Decimal(str(...)) to avoid binary floating point artifacts
    # (e.g. 10.50 * 100 == 1049.9999999999999) and round half away from
    # zero to the nearest integer.
    d = Decimal(str(amount)) * Decimal(100)
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _dead_letter(line_no: int, raw: str, error: str) -> Dict[str, Any]:
    return {
        "status": "invalid",
        "error": error,
        "record": {"raw": raw, "error": error, "line": line_no},
    }


def classify(item: Tuple[int, str]) -> Dict[str, Any]:
    line_no, raw = item

    try:
        parsed: Any = json.loads(raw)
    except json.JSONDecodeError:
        return _dead_letter(line_no, raw, "malformed_json")

    if not isinstance(parsed, dict):
        return _dead_letter(line_no, raw, "malformed_json")

    for field in REQUIRED_FIELDS:
        if field not in parsed:
            return _dead_letter(line_no, raw, f"missing_field:{field}")

    id_val = parsed["id"]
    if not _is_valid_id(id_val):
        return _dead_letter(line_no, raw, "invalid_type:id")

    category_val = parsed["category"]
    if not isinstance(category_val, str):
        return _dead_letter(line_no, raw, "invalid_type:category")

    amount_val = parsed["amount"]
    if not _is_valid_amount(amount_val):
        return _dead_letter(line_no, raw, "invalid_type:amount")

    currency_val = parsed["currency"]
    if not isinstance(currency_val, str):
        return _dead_letter(line_no, raw, "invalid_type:currency")

    if category_val not in ALLOWED_CATEGORIES:
        return _dead_letter(line_no, raw, f"unknown_category:{category_val}")

    if amount_val <= 0:
        return _dead_letter(line_no, raw, "invalid_amount:non_positive")

    if currency_val not in ALLOWED_CURRENCIES:
        return _dead_letter(line_no, raw, f"invalid_currency:{currency_val}")

    normalized = {
        "id": str(id_val),
        "category": category_val,
        "amount_cents": _amount_to_cents(amount_val),
        "currency": currency_val,
    }
    return {"status": "valid", "category": category_val, "record": normalized}


def _to_json_line(record: Dict[str, Any]) -> str:
    return json.dumps(record, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Metrics aggregation (computed once, at end-of-stream)
# ---------------------------------------------------------------------------
def _build_metrics() -> Dict[str, Any]:
    return {
        "total": 0,
        "valid": 0,
        "dead_letter": 0,
        "by_category": {c: 0 for c in ALLOWED_CATEGORIES},
        "by_error": {},
    }


def _fold_metrics(acc: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    acc["total"] += 1
    if item["status"] == "valid":
        acc["valid"] += 1
        acc["by_category"][item["category"]] += 1
    else:
        acc["dead_letter"] += 1
        error = item["error"]
        acc["by_error"][error] = acc["by_error"].get(error, 0) + 1
    return acc


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------
flow = Dataflow("etl_router")

lines = op.input("read_lines", flow, LineFileSource(INPUT_PATH))
classified = op.map("classify", lines, classify)

# --- valid records, routed per category ---
valid_only = op.filter("valid_only", classified, lambda r: r["status"] == "valid")

for _cat in ALLOWED_CATEGORIES:
    _cat_stream = op.filter(
        f"is_{_cat}", valid_only, lambda r, cat=_cat: r["category"] == cat
    )
    _cat_json = op.map(
        f"to_json_{_cat}", _cat_stream, lambda r: _to_json_line(r["record"])
    )
    op.output(
        f"out_{_cat}", _cat_json, LinesFileSink(os.path.join(OUT_DIR, f"{_cat}.jsonl"))
    )

# --- invalid records, routed to the dead-letter sink ---
dead_letters = op.filter("dead_only", classified, lambda r: r["status"] == "invalid")
dead_letter_json = op.map(
    "dead_to_json", dead_letters, lambda r: _to_json_line(r["record"])
)
op.output(
    "dead_letter_out",
    dead_letter_json,
    LinesFileSink(os.path.join(OUT_DIR, "dead_letter.jsonl")),
)

# --- aggregate metrics summary ---
keyed = op.key_on("key_all", classified, lambda _: "all")
metrics_kv = op.fold_final("fold_metrics", keyed, _build_metrics, _fold_metrics)
metrics = op.map("metrics_only", metrics_kv, lambda kv: kv[1])
metrics_json = op.map("metrics_to_json", metrics, _to_json_line)
op.output(
    "metrics_out", metrics_json, LinesFileSink(os.path.join(OUT_DIR, "metrics.json"))
)
