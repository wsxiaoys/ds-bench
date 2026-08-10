import json
import os
from pathlib import Path
from typing import List, Optional, Tuple, Union, Callable

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.connectors.files import _get_path_dev, batch, FileSink

# 1. Ensure the output directory and all output files exist and are truncated
out_dir = Path("/home/user/etl_router/out")
out_dir.mkdir(parents=True, exist_ok=True)

for filename in ["orders.jsonl", "payments.jsonl", "refunds.jsonl", "dead_letter.jsonl", "metrics.json"]:
    filepath = out_dir / filename
    with open(filepath, "w") as f:
        pass


# 2. Custom Source to emit (line_num, line_str)
class _LineNumberedFileSourcePartition(StatefulSourcePartition[Tuple[int, str], Tuple[int, int]]):
    def __init__(self, path: Path, batch_size: int, resume_state: Optional[Tuple[int, int]]):
        self._f = open(path, "rt")
        self._line_idx = 0
        if resume_state is not None:
            byte_offset, line_idx = resume_state
            self._f.seek(byte_offset)
            self._line_idx = line_idx
        
        def gen():
            while True:
                line = self._f.readline()
                if len(line) <= 0:
                    break
                self._line_idx += 1
                if line.endswith("\n"):
                    line = line[:-1]
                yield (self._line_idx, line)
        
        self._batcher = batch(gen(), batch_size)

    def next_batch(self) -> List[Tuple[int, str]]:
        return next(self._batcher)

    def snapshot(self) -> Tuple[int, int]:
        return (self._f.tell(), self._line_idx)

    def close(self) -> None:
        self._f.close()


class LineNumberedFileSource(FixedPartitionedSource[Tuple[int, str], Tuple[int, int]]):
    def __init__(
        self,
        path: Union[Path, str],
        batch_size: int = 1000,
        get_fs_id: Callable[[Path], str] = _get_path_dev,
    ):
        if not isinstance(path, Path):
            path = Path(path)

        self._path = path
        self._batch_size = batch_size
        self._fs_id = get_fs_id(path.parent)

    def list_parts(self) -> List[str]:
        if self._path.exists():
            return [f"{self._fs_id}::{self._path}"]
        else:
            return []

    def build_part(
        self, step_id: str, for_part: str, resume_state: Optional[Tuple[int, int]]
    ) -> _LineNumberedFileSourcePartition:
        _fs_id, path = for_part.split("::", 1)
        assert path == str(self._path), "Can't resume reading from different file"
        return _LineNumberedFileSourcePartition(self._path, self._batch_size, resume_state)


# 3. Record classification and validation rules
def classify_record(line_num: int, raw_line: str) -> Tuple[int, str, str, dict]:
    raw_clean = raw_line
    if raw_clean.endswith("\n"):
        raw_clean = raw_clean[:-1]
    
    # Rule 1: JSON parsing
    try:
        record = json.loads(raw_clean)
    except json.JSONDecodeError:
        return (line_num, "invalid", "malformed_json", {
            "raw": raw_clean,
            "error": "malformed_json",
            "line": line_num
        })
    
    if not isinstance(record, dict):
        return (line_num, "invalid", "malformed_json", {
            "raw": raw_clean,
            "error": "malformed_json",
            "line": line_num
        })
    
    # Rule 2: Required fields
    required_fields = ["id", "category", "amount", "currency"]
    for field in required_fields:
        if field not in record:
            return (line_num, "invalid", f"missing_field:{field}", {
                "raw": raw_clean,
                "error": f"missing_field:{field}",
                "line": line_num
            })
            
    # Rule 3: Field types
    # id must be JSON string or JSON integer, not boolean
    id_val = record["id"]
    if not (isinstance(id_val, (str, int)) and not isinstance(id_val, bool)):
        return (line_num, "invalid", "invalid_type:id", {
            "raw": raw_clean,
            "error": "invalid_type:id",
            "line": line_num
        })
        
    # category must be string
    cat_val = record["category"]
    if not isinstance(cat_val, str):
        return (line_num, "invalid", "invalid_type:category", {
            "raw": raw_clean,
            "error": "invalid_type:category",
            "line": line_num
        })
        
    # amount must be JSON number (integer or float), not boolean
    amt_val = record["amount"]
    if not (isinstance(amt_val, (int, float)) and not isinstance(amt_val, bool)):
        return (line_num, "invalid", "invalid_type:amount", {
            "raw": raw_clean,
            "error": "invalid_type:amount",
            "line": line_num
        })
        
    # currency must be string
    cur_val = record["currency"]
    if not isinstance(cur_val, str):
        return (line_num, "invalid", "invalid_type:currency", {
            "raw": raw_clean,
            "error": "invalid_type:currency",
            "line": line_num
        })
        
    # Rule 4: Allowed categories
    if cat_val not in {"orders", "payments", "refunds"}:
        return (line_num, "invalid", f"unknown_category:{cat_val}", {
            "raw": raw_clean,
            "error": f"unknown_category:{cat_val}",
            "line": line_num
        })
        
    # Rule 5: Non-positive amount
    if amt_val <= 0:
        return (line_num, "invalid", "invalid_amount:non_positive", {
            "raw": raw_clean,
            "error": "invalid_amount:non_positive",
            "line": line_num
        })
        
    # Rule 6: Allowed currencies
    if cur_val not in {"USD", "EUR", "GBP"}:
        return (line_num, "invalid", f"invalid_currency:{cur_val}", {
            "raw": raw_clean,
            "error": f"invalid_currency:{cur_val}",
            "line": line_num
        })
        
    # Valid record normalization
    normalized = {
        "id": str(id_val),
        "category": cat_val,
        "amount_cents": int(round(amt_val * 100)),
        "currency": cur_val
    }
    return (line_num, "valid", cat_val, normalized)


# 4. Metrics Aggregation
def build_metrics() -> dict:
    return {
        "total": 0,
        "valid": 0,
        "dead_letter": 0,
        "by_category": {
            "orders": 0,
            "payments": 0,
            "refunds": 0
        },
        "by_error": {}
    }


def fold_metrics(acc: dict, item: Tuple[int, str, str, dict]) -> dict:
    _, status, cat_or_err, _ = item
    acc["total"] += 1
    if status == "valid":
        acc["valid"] += 1
        acc["by_category"][cat_or_err] += 1
    else:
        acc["dead_letter"] += 1
        acc["by_error"][cat_or_err] = acc["by_error"].get(cat_or_err, 0) + 1
    return acc


# 5. Dataflow Definition
flow = Dataflow("etl_router")

# Input
inp = op.input("input", flow, LineNumberedFileSource("/home/user/etl_router/data/input.jsonl"))

# Classify
classified = op.map("classify", inp, lambda x: classify_record(x[0], x[1]))

# Split into Valid and Invalid
b_out = op.branch("split_valid", classified, lambda x: x[1] == "valid")
valid_stream = b_out.trues
invalid_stream = b_out.falses

# Route Valid Stream to Categories
orders_branch = op.branch("split_orders", valid_stream, lambda x: x[2] == "orders")
orders_stream = orders_branch.trues
non_orders_stream = orders_branch.falses

payments_branch = op.branch("split_payments", non_orders_stream, lambda x: x[2] == "payments")
payments_stream = payments_branch.trues
refunds_stream = payments_branch.falses

# Sinks for Categories
orders_out = op.map("format_orders", orders_stream, lambda x: ("orders", json.dumps(x[3])))
op.output("orders_sink", orders_out, FileSink(out_dir / "orders.jsonl"))

payments_out = op.map("format_payments", payments_stream, lambda x: ("payments", json.dumps(x[3])))
op.output("payments_sink", payments_out, FileSink(out_dir / "payments.jsonl"))

refunds_out = op.map("format_refunds", refunds_stream, lambda x: ("refunds", json.dumps(x[3])))
op.output("refunds_sink", refunds_out, FileSink(out_dir / "refunds.jsonl"))

# Sink for Dead Letter
dead_letter_out = op.map("format_dead_letter", invalid_stream, lambda x: ("dead_letter", json.dumps(x[3])))
op.output("dead_letter_sink", dead_letter_out, FileSink(out_dir / "dead_letter.jsonl"))

# Metrics Aggregation and Sink
keyed_classified = op.map("key_classified", classified, lambda x: ("metrics", x))
folded_metrics = op.fold_final("fold_metrics", keyed_classified, build_metrics, fold_metrics)
metrics_out = op.map("format_metrics", folded_metrics, lambda x: ("metrics", json.dumps(x[1])))
op.output("metrics_sink", metrics_out, FileSink(out_dir / "metrics.json"))
