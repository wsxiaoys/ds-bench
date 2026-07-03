#!/usr/bin/env python3
"""Real-time Top-K Leaderboard with Bytewax.

This script processes a continuous stream of player score updates from a
JSONL input file, tracks the highest score ever achieved by each player
using stateful processing, and maintains the global Top-K players via a
single-worker stateful operator. The final Top-K leaderboard is written
to an output JSON file sorted by score in descending order.

Usage:
    python leaderboard.py --input <input_file> --output <output_file> --k <k>
"""

import argparse
import heapq
import json
import sys
from pathlib import Path
from typing import List, Optional, Tuple

from typing_extensions import override

from bytewax._bytewax import run_main
from bytewax.connectors.files import FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators import (
    input,
    key_on,
    key_rm,
    map,
    map_value,
    output,
    stateful_map,
)
from bytewax.outputs import DynamicSink, StatelessSinkPartition


# ----------------------------------------------------------------------------
# Stateful mapper: track the highest score seen for each player.
#
# Input value: a dict {"player_id": str, "score": number}.
# State: float | None  (previous highest score for this player).
# Output value: a dict {"player_id": str, "score": <current max>} for
# downstream consumption.
# ----------------------------------------------------------------------------
def track_max(state: Optional[float], event: dict) -> Tuple[float, dict]:
    """Update the per-player max score and emit the current max."""
    new_score = float(event["score"])
    if state is None:
        new_max = new_score
    elif new_score > state:
        new_max = new_score
    else:
        new_max = state
    output_event = {
        "player_id": event["player_id"],
        "score": new_max,
    }
    return (new_max, output_event)


# ----------------------------------------------------------------------------
# Stateful mapper: maintain the global Top-K players.
#
# State is a bounded max-heap (via negation on Python's min-heap)
# containing at most K entries of ``(-score, player_id)`` pairs. On each
# update, any prior entry for the same player is removed, the new entry is
# inserted, and the heap is trimmed to K. The emitted snapshot is the
# current Top-K sorted by score descending.
# ----------------------------------------------------------------------------
class _TopKState:
    """Wrapper around a max-heap bounded to ``K`` entries."""

    __slots__ = ("_heap", "_k")

    def __init__(self, k: int) -> None:
        # Heap entries: (-score, player_id). Negation gives max-semantics
        # when used with ``heapq`` (a min-heap).
        self._heap: List[Tuple[float, str]] = []
        self._k = k

    def update(self, player_id: str, score: float) -> None:
        # Drop any stale entry for this player to keep the heap compact.
        if self._heap:
            self._heap = [(s, p) for (s, p) in self._heap if p != player_id]
            heapq.heapify(self._heap)
        heapq.heappush(self._heap, (-float(score), player_id))
        while len(self._heap) > self._k:
            heapq.heappop(self._heap)

    def snapshot(self) -> List[dict]:
        # ``sorted`` ascending by `-score` yields descending by score.
        ordered = sorted(self._heap, key=lambda sp: sp[0])
        return [{"player_id": p, "score": -s} for (s, p) in ordered]


def _make_track_top_k(k: int):
    """Build a stateful_map mapper closure carrying the Top-K size."""

    def track_top_k(
        state: Optional[_TopKState], event: dict
    ) -> Tuple[_TopKState, List[dict]]:
        if state is None:
            state = _TopKState(k)
        state.update(event["player_id"], float(event["score"]))
        snap = state.snapshot()
        return (state, snap)

    return track_top_k


# ----------------------------------------------------------------------------
# Custom DynamicSink that retains the most recently emitted value so we can
# read the final Top-K snapshot back from Python after the dataflow ends.
# ----------------------------------------------------------------------------
class _CaptureSinkPartition(StatelessSinkPartition):
    def __init__(self, owner: "FinalCaptureSink") -> None:
        self._owner = owner

    @override
    def write_batch(self, items: List[object]) -> None:
        # Items within a single batch arrive in-order; ``items[-1]`` is the
        # most-recent snapshot in this batch.
        if items:
            self._owner.value = items[-1]


class FinalCaptureSink(DynamicSink[object]):
    """A Python-attribute sink: retains only the latest emitted value."""

    def __init__(self) -> None:
        self.value: Optional[object] = None

    @override
    def build(
        self, _step_id: str, _worker_index: int, _worker_count: int
    ) -> _CaptureSinkPartition:
        return _CaptureSinkPartition(self)


# ----------------------------------------------------------------------------
# JSONL parsing helpers.
# ----------------------------------------------------------------------------
def _safe_json_loads(line: str):
    """Parse a JSONL line into ``{"player_id", "score"}`` or None on error."""
    line = line.strip()
    if not line:
        return None
    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    if "player_id" not in parsed or "score" not in parsed:
        return None
    if not isinstance(parsed["player_id"], str):
        return None
    try:
        score = float(parsed["score"])
    except (TypeError, ValueError):
        return None
    return {"player_id": parsed["player_id"], "score": score}


def _keep_valid(event):
    """Return event unchanged, or a sentinel dict that downstream stateful
    operators will ignore. We do this so skip-items still produce a stream
    item (since we can't remove items from a Bytewax stream mid-flow). The
    downstream stateful_map picks the higher score; sentinels never win.
    """
    if event is None:
        return {"player_id": "__SKIP__", "score": float("-inf")}
    return event


# ----------------------------------------------------------------------------
# Dataflow construction.
# ----------------------------------------------------------------------------
def build_flow_for_path(
    input_path: str, k: int, sink: FinalCaptureSink
) -> Dataflow:
    """Construct the leaderboard dataflow for a given input file path."""
    flow = Dataflow("leaderboard")

    # 1. Stream raw lines (lazy via ``FileSource``).
    lines = input("inp_lines", flow, FileSource(input_path))
    # 2. Parse each line as JSON, substituting a skip sentinel on failure.
    events = map("parse_json", lines, lambda s: _keep_valid(_safe_json_loads(s)))
    # 3. Key by player_id so each player's scores route to one worker.
    keyed = key_on("key_player", events, lambda e: e["player_id"])
    # 4. Per-player max-score tracking.
    max_scores = stateful_map("track_max", keyed, track_max)
    # 5. Drop the redundant key from the keyed stream.
    pairs = key_rm("rm_player_key", max_scores)
    # 6. Strip out sentinel rows so they don't reach Top-K state.
    def _strip_sentinel(item):
        if item.get("player_id") == "__SKIP__":
            return None
        return item

    clean_pairs = map("strip_sentinels", pairs, _strip_sentinel)
    # 7. Route every update to a single "global" key for Top-K aggregation.
    #    (Sent None values are filtered below.)
    def _skip_none(item):
        if item is None:
            return []
        return [item]

    flat_pairs = map("flat_pairs", clean_pairs, _skip_none)
    # Use flat_map if available; otherwise use a regular map and skip in track_max
    # Simpler: just keep the sentinel; the track_max will see -inf which never wins.
    # Re-route to "global":
    global_stream = key_on("global_key", pairs, lambda _x: "global")
    # 8. Maintain the global Top-K using a bounded max-heap state.
    top_k_stream = stateful_map(
        "track_top_k", global_stream, _make_track_top_k(k)
    )
    # 9. Capture each Top-K snapshot; the final value is retained.
    output("capture", top_k_stream, sink)
    return flow


# ----------------------------------------------------------------------------
# Entry point.
# ----------------------------------------------------------------------------
def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Real-time Top-K Leaderboard with Bytewax."
    )
    parser.add_argument(
        "--input", required=True, help="Path to input JSONL file."
    )
    parser.add_argument(
        "--output", required=True, help="Path to output JSON file."
    )
    parser.add_argument(
        "--k",
        required=True,
        type=int,
        help="Number of top players to maintain in the leaderboard.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        print(f"error: input file does not exist: {input_path}", file=sys.stderr)
        return 1
    if args.k <= 0:
        print("error: --k must be a positive integer", file=sys.stderr)
        return 1

    sink = FinalCaptureSink()
    flow = build_flow_for_path(str(input_path), args.k, sink)

    # Execute the dataflow locally; blocks until EOF.
    run_main(flow)

    # Extract the captured final Top-K and normalise the output schema.
    if sink.value is None:
        leaderboard: List[dict] = []
    else:
        snapshot = sink.value
        if not isinstance(snapshot, list):
            leaderboard = []
        else:
            leaderboard = sorted(
                snapshot,
                key=lambda d: float(d["score"]),
                reverse=True,
            )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(leaderboard, fh, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
