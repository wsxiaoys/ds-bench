#!/usr/bin/env python3
"""Real-time Top-K Leaderboard with Bytewax.

Reads a stream of player score events from a JSONL file, maintains the
maximum score achieved by each player using stateful processing, and
continuously computes the global Top-K players. The final Top-K
leaderboard is written as a single JSON array to the output file.

Usage:
    python leaderboard.py --input <input_file> --output <output_file> --k <k>
"""

import argparse
import heapq
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.testing import run_main


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Real-time Top-K Leaderboard with Bytewax"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the input JSONL file (one event per line).",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to the output JSON file (the final Top-K array).",
    )
    parser.add_argument(
        "--k",
        type=int,
        required=True,
        help="Number of top players to maintain.",
    )
    return parser.parse_args()


def parse_event(line: str) -> Optional[Dict]:
    """Parse a JSONL line into a ``{"player_id", "score"}`` dict.

    Blank lines are skipped by returning ``None``.
    """
    line = line.strip()
    if not line:
        return None
    event = json.loads(line)
    if "player_id" not in event or "score" not in event:
        return None
    return event


def build_flow(input_path: str, output_path: str, k: int) -> Dataflow:
    """Build the Bytewax dataflow for the Top-K leaderboard."""
    flow = Dataflow("leaderboard")

    # 1. Read the input JSONL file line-by-line.
    lines = op.input("input", flow, FileSource(input_path))

    # 2. Parse each line into a {"player_id", "score"} event, skipping
    #    blank / malformed lines.
    events = op.filter_map("parse", lines, parse_event)

    # 3. Key the stream by player_id so each player's history is handled
    #    by a single state partition.
    keyed_by_player = op.key_on(
        "key_player", events, lambda event: event["player_id"]
    )

    # 4. Stateful: track the maximum score ever achieved by each player.
    #    Only emit an update when a player's maximum strictly increases.
    def max_score_mapper(
        state: Optional[float], event: Dict
    ) -> Tuple[Optional[float], List[Tuple[str, float]]]:
        new_score = event["score"]
        if state is None or new_score > state:
            # New maximum: persist it and emit the update downstream.
            return (new_score, [(event["player_id"], new_score)])
        # No improvement; keep the current state and emit nothing.
        return (state, [])

    max_scores = op.stateful_flat_map(
        "max_score", keyed_by_player, max_score_mapper
    )

    # 5. Route every updated player maximum to a single worker so the
    #    global Top-K can be maintained consistently. Drop the per-player
    #    key and re-key everything to a constant key.
    unkeyed = op.key_rm("drop_player_key", max_scores)
    global_keyed = op.key_on(
        "key_global", unkeyed, lambda _value: "GLOBAL"
    )

    # 6. Stateful: maintain the global Top-K of size ``k``.
    #
    # The state is a 2-tuple of:
    #   * ``heap``    - a min-heap of (score, player_id) entries. The
    #                   smallest score among the current Top-K sits at the
    #                   top, giving O(1) access to the eviction
    #                   threshold.
    #   * ``current`` - a dict mapping player_id -> best known score for
    #                   the players currently considered to be in the
    #                   Top-K. This lets us detect and lazily discard
    #                   stale heap entries (old scores for players whose
    #                   maximum has since increased or who were evicted).
    #
    # Because player scores only ever increase, a player already in the
    # Top-K never needs to be evicted for a lower score; they only move
    # up. A player outside the Top-K can only enter by beating the
    # current minimum. Memory is O(k) for ``current`` (the heap holds at
    # most O(k) live entries plus a bounded number of stale ones that are
    # cleaned from the top on demand).
    def top_k_mapper(
        state: Optional[Tuple[List[Tuple[float, str]], Dict[str, float]]],
        item: Tuple[str, float],
    ) -> Tuple[
        Tuple[List[Tuple[float, str]], Dict[str, float]],
        List[Dict[str, float]],
    ]:
        player_id, new_score = item
        if state is None:
            heap: List[Tuple[float, str]] = []
            current: Dict[str, float] = {}
        else:
            heap, current = state

        def clean_stale() -> None:
            """Pop heap entries whose score no longer matches ``current``."""
            while heap and heap[0][0] != current.get(heap[0][1]):
                heapq.heappop(heap)

        if player_id in current:
            # Player already in Top-K; their score only increases, so
            # just record the new best and push a fresh heap entry (the
            # old one becomes stale and is cleaned lazily).
            current[player_id] = new_score
            heapq.heappush(heap, (new_score, player_id))
        else:
            # Player not currently in Top-K.
            clean_stale()
            if len(current) < k:
                # Top-K not yet full: admit the player.
                current[player_id] = new_score
                heapq.heappush(heap, (new_score, player_id))
            elif heap and new_score > heap[0][0]:
                # Top-K full and the new score beats the minimum:
                # evict the current minimum and admit this player.
                _, evicted_id = heapq.heappop(heap)
                current.pop(evicted_id, None)
                current[player_id] = new_score
                heapq.heappush(heap, (new_score, player_id))
            # else: the new score is not high enough to enter the Top-K.

        # Emit the current Top-K sorted by score in descending order.
        ranked = sorted(current.items(), key=lambda kv: kv[1], reverse=True)
        leaderboard = [
            {"player_id": player, "score": score} for player, score in ranked
        ]
        return ((heap, current), leaderboard)

    top_k = op.stateful_map("top_k", global_keyed, top_k_mapper)

    # 7. Capture the final Top-K once the input stream reaches EOF.
    def keep_last(
        _acc: Optional[List[Dict[str, float]]],
        item: List[Dict[str, float]],
    ) -> List[Dict[str, float]]:
        return item

    final = op.fold_final("final", top_k, lambda: None, keep_last)

    # 8. Serialize the final leaderboard into a single JSON array string.
    #    `map_value` keeps the (key, value) shape required by the file
    #    sink for partition routing.
    def to_json(leaderboard: Optional[List[Dict[str, float]]]) -> str:
        if leaderboard is None:
            leaderboard = []
        return json.dumps(leaderboard)

    json_out = op.map_value("to_json", final, to_json)

    # 9. Write the JSON array to the output file.
    op.output("write_output", json_out, FileSink(output_path))

    return flow


def main() -> None:
    """Entry point: parse args, build the flow, and run it."""
    args = parse_args()
    if args.k <= 0:
        raise ValueError("--k must be a positive integer")
    flow = build_flow(args.input, args.output, args.k)
    run_main(flow)

    # When the input stream is empty, no items ever reach the sink, so
    # the output file is never created. Guarantee a valid (empty) JSON
    # array exists in that case.
    out_path = Path(args.output)
    if not out_path.exists() or out_path.stat().st_size == 0:
        out_path.write_text("[]\n")


if __name__ == "__main__":
    main()