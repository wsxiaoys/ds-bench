#!/usr/bin/env python3
"""Real-time Top-K Leaderboard using Bytewax."""

import argparse
import heapq
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import bytewax.operators as op
from bytewax.dataflow import Dataflow
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax.testing import run_main
from typing_extensions import override


# Global to capture the final Top-K output.
FINAL_OUTPUT: List = []


# ----------------------------- Input Source ----------------------------- #

class _JSONLPartition(StatefulSourcePartition):
    def __init__(self, path: str, resume_state):
        self._path = path
        self._f = open(path, "rt")
        self._eof = False
        if resume_state is not None:
            self._f.seek(resume_state)

    @override
    def next_batch(self):
        batch = []
        if self._eof:
            raise StopIteration()
        for line in self._f:
            line = line.strip()
            if not line:
                continue
            batch.append(line)
        self._eof = True
        return batch

    @override
    def snapshot(self):
        return self._f.tell()

    @override
    def close(self):
        try:
            self._f.close()
        except Exception:
            pass

    @override
    def next_awake(self):
        return None


class JSONLSource(FixedPartitionedSource):
    """A source that reads a JSONL file line-by-line."""

    def __init__(self, path: str):
        self._path = path

    @override
    def list_parts(self):
        return ["single"]

    @override
    def build_part(self, step_id, for_part, resume_state):
        return _JSONLPartition(self._path, resume_state)


# ----------------------------- Output Sink ----------------------------- #

class _CollectSinkPartition(StatelessSinkPartition):
    def __init__(self):
        self._items: List = []

    @override
    def write_batch(self, items):
        self._items.extend(items)

    @override
    def close(self):
        FINAL_OUTPUT.extend(self._items)


class CollectSink(DynamicSink):
    @override
    def build(self, step_id, worker_index, worker_count):
        return _CollectSinkPartition()


# ----------------------------- Dataflow ----------------------------- #

def _heap_to_sorted_list(heap):
    # Return the heap sorted by score descending: [(player_id, score), ...]
    return sorted(((p, s) for s, p in heap), key=lambda x: x[1], reverse=True)


def build_dataflow(input_path: str, k: int) -> Dataflow:
    flow = Dataflow("leaderboard")

    # 1. Read raw JSONL lines.
    raw = op.input("in", flow, JSONLSource(input_path))

    # 2. Parse each line into (player_id, score) and key on player_id.
    parsed = op.map("parse", raw, lambda line: json.loads(line))
    keyed = op.key_on("by_player", parsed, lambda ev: ev["player_id"])

    # 3. Stateful map: keep the max score ever seen per player.
    # The value W is just the score. The player_id is in the key.
    def max_score(state, ev):
        score = ev["score"]
        if state is None or score > state:
            new_state = score
        else:
            new_state = state
        return (new_state, new_state)

    player_max = op.stateful_map("player_max", keyed, max_score)

    # 4. Re-key to a single global key so all updates land on one worker.
    # After key_on on a KeyedStream, the item type is (key, value) pair.
    # The new stream has key='GLOBAL' and value=(old_key, old_value)=(player_id, score).
    routed = op.key_on("to_global", player_max, lambda _kv: "GLOBAL")

    # 5. Stateful map on the global key: maintain a min-heap of size K.
    # The value received is (player_id, score).
    def topk_step(state, item):
        player_id, score = item
        heap = state
        if heap is None:
            heap = []
        current = {pid: sc for sc, pid in heap}
        if player_id in current:
            if score > current[player_id]:
                heap = [(s, p) for (s, p) in heap if p != player_id]
                heapq.heapify(heap)
            else:
                return (heap, _heap_to_sorted_list(heap))
        if len(heap) < k:
            heapq.heappush(heap, (score, player_id))
        else:
            if score > heap[0][0]:
                heapq.heapreplace(heap, (score, player_id))
        return (heap, _heap_to_sorted_list(heap))

    topk_stream = op.stateful_map("topk", routed, topk_step)

    # 6. Extract the value (sorted top-K list) and output to a collecting sink.
    # map_value transforms the value in a KeyedStream.
    values = op.map_value("extract", topk_stream, lambda v: v)
    op.output("out", values, CollectSink())

    return flow


# ----------------------------- Entry point ----------------------------- #

def main():
    parser = argparse.ArgumentParser(description="Top-K Leaderboard with Bytewax")
    parser.add_argument("--input", required=True, help="Input JSONL file")
    parser.add_argument("--output", required=True, help="Output JSON file")
    parser.add_argument("--k", required=True, type=int, help="Top-K size")
    args = parser.parse_args()

    input_path = args.input
    output_path = args.output
    k = args.k

    flow = build_dataflow(input_path, k)
    run_main(flow)

    final_top_k = []
    if FINAL_OUTPUT:
        # Each item in FINAL_OUTPUT is (key, value) from the keyed stream.
        # value is the sorted list of (player_id, score) tuples.
        # Take the last non-empty list.
        for item in reversed(FINAL_OUTPUT):
            if isinstance(item, tuple) and len(item) == 2:
                _key, val = item
                if val:
                    final_top_k = val
                    break
            elif isinstance(item, list) and item:
                final_top_k = item
                break

    result = [{"player_id": pid, "score": sc} for (pid, sc) in final_top_k]

    with open(output_path, "w") as f:
        json.dump(result, f)


if __name__ == "__main__":
    main()
