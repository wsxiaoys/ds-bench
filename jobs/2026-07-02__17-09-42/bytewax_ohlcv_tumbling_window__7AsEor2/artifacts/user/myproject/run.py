"""Tumbling window OHLCV aggregation using Bytewax.

Reads a CSV of trades (`timestamp,symbol,price,volume`), groups by symbol,
applies a 1-minute tumbling window using event time, and writes OHLCV bars
to a JSONL file.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import bytewax.operators as op
from bytewax.connectors.files import CSVSource
from bytewax.dataflow import Dataflow
from bytewax.operators.windowing import EventClock, TumblingWindower, fold_window
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax.testing import run_main
from typing_extensions import override


# State carried in each window: (open, high, low, close, volume).
OHLCVState = Tuple[float, float, float, float, float]
# Value flowing through the keyed stream: dict with parsed fields.
TradeValue = Dict[str, Any]


def parse_args(argv: Optional[list] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate trades into 1-minute OHLCV bars via Bytewax.",
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to the input CSV file with columns timestamp,symbol,price,volume.",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Path to the output JSONL file where OHLCV bars will be written.",
    )
    return parser.parse_args(argv)


def _parse_timestamp(value: str) -> datetime:
    """Parse an ISO 8601 timestamp into an aware UTC datetime.

    Accepts strings like ``2023-10-01T10:00:00Z`` or with an explicit
    numeric offset, as emitted by ``datetime.isoformat()``.
    """
    # ``fromisoformat`` does not understand the trailing ``Z`` before
    # Python 3.11, so normalize it to ``+00:00`` for compatibility.
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        # Treat naive timestamps as UTC to keep comparisons well-defined.
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


def parse_trade(row: Dict[str, str]) -> TradeValue:
    """Convert a raw CSV row (string values) into typed fields."""
    return {
        "timestamp": _parse_timestamp(row["timestamp"]),
        "symbol": row["symbol"],
        "price": float(row["price"]),
        "volume": float(row["volume"]),
    }


def build_ohlcv() -> TradeValue:
    """Initial accumulator for a (yet empty) window. ``None`` means no
    trades have been seen yet for this window."""
    return None  # type: ignore[return-value]


def fold_trade(state: Optional[OHLCVState], trade: TradeValue) -> OHLCVState:
    """Fold a single trade into the running OHLCV state."""
    price = trade["price"]
    volume = trade["volume"]
    if state is None:
        # First trade in the window seeds open/high/low/close.
        return (price, price, price, price, volume)
    open_p, high_p, low_p, _close_p, vol = state
    return (
        open_p,
        max(high_p, price),
        min(low_p, price),
        price,  # close is the price of the most recent trade
        vol + volume,
    )


def merge_ohlcv(a: OHLCVState, b: OHLCVState) -> OHLCVState:
    """Merge two OHLCV accumulators. Not used by tumbling windows, but
    ``fold_window`` requires a merger function."""
    open_a, high_a, low_a, close_a, vol_a = a
    open_b, high_b, low_b, close_b, vol_b = b
    return (
        open_a if open_a <= open_b else open_b,
        max(high_a, high_b),
        min(low_a, low_b),
        close_b if close_b is not None else close_a,
        vol_a + vol_b,
    )


def format_bar(
    symbol: str,
    ohlcv: OHLCVState,
    window_start: datetime,
) -> str:
    """Render one closed window as a JSON object serialized to a line."""
    open_p, high_p, low_p, close_p, volume = ohlcv
    bar = {
        "window_start": window_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "symbol": symbol,
        "open": open_p,
        "high": high_p,
        "low": low_p,
        "close": close_p,
        "volume": volume,
    }
    return json.dumps(bar)


class _JsonlSinkPartition(StatelessSinkPartition[str]):
    """Append each received line to the configured file, then flush+fsync."""

    def __init__(self, path: Path) -> None:
        self._path = path
        # Open in write mode and truncate so re-runs produce a fresh file.
        # ``DynamicSink`` builds a new partition per worker, and we run a
        # single worker for batch processing.
        self._f = open(path, "w", encoding="utf-8")

    @override
    def write_batch(self, items: List[str]) -> None:
        for line in items:
            self._f.write(line)
            self._f.write("\n")
        self._f.flush()

    @override
    def close(self) -> None:
        try:
            self._f.flush()
        finally:
            self._f.close()


class JsonlFileSink(DynamicSink[str]):
    """A simple ``DynamicSink`` that writes each item as a JSONL line.

    Unlike :class:`bytewax.connectors.files.FileSink`, this sink does not
    require a keyed upstream stream; each emitted string is written verbatim
    followed by a newline.
    """

    def __init__(self, path: Path) -> None:
        self._path = path

    @override
    def build(
        self, _step_id: str, _worker_index: int, _worker_count: int
    ) -> _JsonlSinkPartition:
        return _JsonlSinkPartition(self._path)


def build_flow(input_path: Path, output_path: Path) -> Dataflow:
    """Build the Bytewax dataflow that performs the aggregation."""
    flow = Dataflow("ohlcv_1m")

    # 1. Read trades from the CSV file (each item is a dict keyed by column).
    raw_trades = op.input("csv_in", flow, CSVSource(input_path))

    # 2. Parse the string columns into typed Python objects.
    trades = op.map("parse", raw_trades, parse_trade)

    # 3. Key by ticker symbol so each symbol has its own window state.
    keyed = op.key_on("by_symbol", trades, lambda t: t["symbol"])

    # 4. Define event-time windowing: 1-minute tumbling windows aligned to
    #    whole-minute boundaries in UTC.
    clock = EventClock(
        ts_getter=lambda t: t["timestamp"],
        wait_for_system_duration=timedelta(seconds=0),
    )
    # The alignment epoch only matters for choosing which UTC instant starts
    # window_id 0. Choosing 1970-01-01 means the integer ``window_id`` that
    # Bytewax emits is exactly the number of minutes since the epoch for the
    # window's start. This lets us recover ``window_start`` deterministically
    # without needing to join the windowed output with the metadata stream
    # (which would pair by arrival order and risk misalignment).
    align_to = datetime(1970, 1, 1, tzinfo=timezone.utc)
    window_length = timedelta(minutes=1)
    windower = TumblingWindower(
        length=window_length,
        align_to=align_to,
    )

    # 5. Fold the trades into the running OHLCV state per (symbol, window).
    windowed = fold_window(
        "ohlcv_fold",
        keyed,
        clock,
        windower,
        builder=build_ohlcv,
        folder=fold_trade,
        merger=merge_ohlcv,
    )

    # 6. ``windowed.down`` items are ``(symbol, (window_id, ohlcv))``. Recover
    #    the window start time from ``window_id`` and the windower config.
    def to_jsonl(item: Tuple[str, Tuple[int, OHLCVState]]) -> str:
        symbol, (window_id, ohlcv) = item
        window_start = align_to + window_length * window_id
        return format_bar(symbol, ohlcv, window_start)

    lines = op.map("to_jsonl", windowed.down, to_jsonl)

    # 7. Write each JSONL line to the output file. The custom sink opens
    #    the file in write mode, so re-running overwrites previous results.
    op.output("jsonl_out", lines, JsonlFileSink(output_path))

    return flow


def main(argv: Optional[list] = None) -> int:
    args = parse_args(argv)

    if not args.input.exists():
        print(f"error: input file does not exist: {args.input}", file=sys.stderr)
        return 1

    # ``FileSink`` opens the file in append mode and seeks to 0, which
    # truncates it. Ensure the parent directory exists for the output.
    args.output.parent.mkdir(parents=True, exist_ok=True)

    flow = build_flow(args.input, args.output)
    run_main(flow)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())