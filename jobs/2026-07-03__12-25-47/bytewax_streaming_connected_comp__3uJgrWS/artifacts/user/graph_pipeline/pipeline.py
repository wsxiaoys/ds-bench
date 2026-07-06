"""Bytewax dataflow for streaming connected components with Union-Find.

Reads edges from a JSONL file, maintains a global Union-Find structure
in a single stateful partition, and emits per-edge events describing
whether the edge was already in the same component or produced a merge.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
import bytewax.operators as op

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GRAPH_DIR = Path("/home/user/graph_pipeline")
INPUT_PATH = GRAPH_DIR / "input_edges.jsonl"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

# All edges get the same key so they are routed to a single stateful
# partition, which is necessary because Union-Find needs a global view.
PARTITION_KEY = "global"


# ---------------------------------------------------------------------------
# Union-Find state
# ---------------------------------------------------------------------------


class UnionFind:
    """Disjoint set data structure with path compression and union by size.

    The state is held in two plain dicts so the entire structure is fully
    picklable, which is required by Bytewax's SQLite recovery.
    """

    __slots__ = ("_parent", "_size")

    def __init__(self) -> None:
        self._parent: Dict[str, str] = {}
        self._size: Dict[str, int] = {}

    def _ensure(self, node: str) -> None:
        if node not in self._parent:
            self._parent[node] = node
            self._size[node] = 1

    def find(self, node: str) -> str:
        # Walk up to the root.
        root = node
        while self._parent[root] != root:
            root = self._parent[root]
        # Path compression: re-parent every node on the path.
        while self._parent[node] != root:
            nxt = self._parent[node]
            self._parent[node] = root
            node = nxt
        return root

    def union(self, a: str, b: str) -> Tuple[bool, int]:
        """Merge components containing ``a`` and ``b``.

        Returns ``(merged, new_component_size)``.
        """
        self._ensure(a)
        self._ensure(b)
        ra = self.find(a)
        rb = self.find(b)
        if ra == rb:
            return False, self._size[ra]
        # Union by size: attach the smaller tree under the larger root.
        if self._size[ra] < self._size[rb]:
            ra, rb = rb, ra
        self._parent[rb] = ra
        self._size[ra] += self._size[rb]
        # Drop the size entry of the absorbed root to keep the state tidy.
        self._size.pop(rb, None)
        return True, self._size[ra]

    def component_size(self, node: str) -> int:
        self._ensure(node)
        return self._size[self.find(node)]


# ---------------------------------------------------------------------------
# Stream processing
# ---------------------------------------------------------------------------


def parse_edge(line: str) -> Dict[str, str]:
    """Parse a single JSONL line into an ``{"u": ..., "v": ...}`` dict."""
    obj = json.loads(line)
    return {"u": obj["u"], "v": obj["v"]}


def process_edge(
    state: Optional[UnionFind], edge: Dict[str, str]
) -> Tuple[UnionFind, Dict[str, Any]]:
    """Update Union-Find with a single edge and produce an event.

    Returns ``(updated_state, emitted_event)``. ``emitted_event`` is a dict
    ready to be serialized as JSON.
    """
    if state is None:
        state = UnionFind()

    u, v = edge["u"], edge["v"]
    merged, size = state.union(u, v)

    if merged:
        event = {
            "u": u,
            "v": v,
            "status": "merged",
            "new_component_size": size,
        }
    else:
        event = {
            "u": u,
            "v": v,
            "status": "already_connected",
            "component_size": size,
        }

    return state, event


def to_json_line(event: Dict[str, Any]) -> str:
    """Serialize an event dict to a single-line JSON string."""
    return json.dumps(event, separators=(",", ":"), sort_keys=False)


# ---------------------------------------------------------------------------
# Dataflow construction
# ---------------------------------------------------------------------------


def build_output_path() -> Path:
    """Build the output file path using the current run id."""
    run_id = RUN_ID_PATH.read_text().strip()
    return GRAPH_DIR / f"output_events_{run_id}.jsonl"


def build_dataflow() -> Tuple[Dataflow, Path]:
    """Build the connected-components dataflow."""
    flow = Dataflow("connected_components")

    # 1. Read raw JSONL lines.
    raw = op.input("edges_in", flow, FileSource(INPUT_PATH))

    # 2. Parse each line into an {u, v} dict.
    edges = op.map("parse", raw, parse_edge)

    # 3. Route every edge to the same keyed partition so that all state
    #    modifications happen on a single instance.
    keyed = op.key_on("single_partition", edges, lambda _e: PARTITION_KEY)

    # 4. Maintain Union-Find per partition and emit a status event.
    stateful = op.stateful_map("union_find", keyed, process_edge)

    # 5. Drop the key (the underlying FileSink is a FixedPartitionedSink
    #    that expects (key, value) tuples but our output file is single
    #    partitioned so we can just write the values).
    values = op.map_value("drop_key", stateful, to_json_line)

    # 6. Write JSON lines to the output file.
    output_path = build_output_path()
    op.output("events_out", values, FileSink(output_path))

    return flow, output_path


# When executed via `python -m bytewax.run pipeline:get_flow` the CLI
# will import this module and look for a dataflow object exposed by the
# name below. We also support being imported as a library so the dataflow
# can be inspected programmatically.
flow, _OUTPUT_PATH = build_dataflow()
get_flow = lambda: flow


if __name__ == "__main__":
    # Allow direct invocation for quick debugging; the CLI is preferred
    # for production because it supports recovery and multi-process
    # scaling.
    from bytewax.testing import run_main

    flow_local, _ = build_dataflow()
    run_main(flow_local)
