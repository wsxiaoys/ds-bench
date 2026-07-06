"""Streaming Connected Components with Bytewax.

This module defines a Bytewax dataflow that processes a stream of edges and
maintains the connected components (communities) of a graph using a
Union-Find (Disjoint Set) data structure.

The dataflow:
  1. Reads edges (one JSON object per line) from ``input_edges.jsonl``.
  2. Routes every edge to a single ``stateful_map`` partition via a constant
     key (Union-Find requires a global view).
  3. For each edge ``(u, v)`` either merges two components or reports the
     pair is already connected, emitting a JSON event describing the
     outcome.
  4. Writes the resulting events (one JSON object per line, preserving the
     order of the input edges) to ``output_events_<run-id>.jsonl``.

The pipeline is fully picklable so Bytewax's SQLite-based recovery can
snapshot/restore the Union-Find state across restarts.

Run with::

    python -m bytewax.recovery ./recovery_db 1   # one-time setup
    python -m bytewax.run -r ./recovery_db -s 10 \
        /home/user/graph_pipeline/pipeline.py:flow
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
import bytewax.operators as op


# --------------------------------------------------------------------------- #
# Paths / configuration
# --------------------------------------------------------------------------- #

THIS_DIR = Path("/home/user/graph_pipeline")
INPUT_PATH = THIS_DIR / "input_edges.jsonl"

# Read the run-id from the artifact file.  When the artifact file is missing
# we fall back to a sensible default so the module can still be imported
# outside of an orchestrated run (e.g. for unit tests).
_RUN_ID_FILE = Path("/logs/artifacts/run-id")


def _load_run_id() -> str:
    try:
        return _RUN_ID_FILE.read_text().strip()
    except FileNotFoundError:
        return "local"


RUN_ID = _load_run_id()
OUTPUT_PATH = THIS_DIR / f"output_events_{RUN_ID}.jsonl"

# Constant routing key used to funnel every edge into the same stateful
# partition so the Union-Find sees a global view.
ROUTING_KEY = "uf"


# --------------------------------------------------------------------------- #
# Union-Find (Disjoint Set)
# --------------------------------------------------------------------------- #


class UnionFind:
    """Picklable Union-Find with path compression and union by size.

    The internal state is a pair of plain ``dict`` instances so that the
    whole structure round-trips cleanly through ``pickle``, which is what
    Bytewax's SQLite recovery uses to snapshot operator state.
    """

    __slots__ = ("_parent", "_size")

    def __init__(self) -> None:
        self._parent: Dict[Any, Any] = {}
        self._size: Dict[Any, int] = {}

    # -- pickle protocol -------------------------------------------------- #
    #
    # We rely on the default pickle behaviour for ``__slots__`` classes,
    # which enumerates the slot values.  Defining ``__getstate__`` /
    # ``__setstate__`` here is enough: pickle will serialise the dict
    # returned by ``__getstate__`` and call ``__setstate__`` on load with
    # that dict.  No custom ``__reduce__`` is needed and adding one would
    # in fact *override* these hooks and drop the instance state.

    def __getstate__(self) -> Dict[str, Dict[Any, Any]]:
        return {"_parent": self._parent, "_size": self._size}

    def __setstate__(self, state: Dict[str, Dict[Any, Any]]) -> None:
        self._parent = state["_parent"]
        self._size = state["_size"]

    # -- core operations -------------------------------------------------- #

    def _make(self, x: Any) -> None:
        if x not in self._parent:
            self._parent[x] = x
            self._size[x] = 1

    def find(self, x: Any) -> Any:
        self._make(x)
        # Iterative find with path compression.
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        while self._parent[x] != root:
            self._parent[x], x = root, self._parent[x]
        return root

    def union(self, x: Any, y: Any) -> Tuple[bool, int]:
        """Merge the components containing ``x`` and ``y``.

        Returns ``(merged, size)`` where ``merged`` is ``True`` iff the two
        nodes were previously in distinct components and ``size`` is the
        size of the resulting component.
        """
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False, self._size[rx]
        # Union by size: attach the smaller tree under the larger one.
        if self._size[rx] < self._size[ry]:
            rx, ry = ry, rx
        self._parent[ry] = rx
        self._size[rx] += self._size[ry]
        return True, self._size[rx]

    def size(self, x: Any) -> int:
        return self._size[self.find(x)]

    def __len__(self) -> int:
        return len(self._parent)


# --------------------------------------------------------------------------- #
# Dataflow
# --------------------------------------------------------------------------- #


def _parse_edge(line: str) -> Dict[str, str]:
    """Parse a single JSONL line into an edge dict."""
    return json.loads(line)


def _format_event(event: Dict[str, Any]) -> str:
    """Serialize an event dict to a single JSONL line (no trailing newline)."""
    return json.dumps(event, sort_keys=True)


def _process_edge(
    state: Optional[UnionFind], edge: Dict[str, str]
) -> Tuple[UnionFind, Dict[str, Any]]:
    """Stateful_map mapper: apply Union-Find to a single edge.

    The previous state (``None`` on the first item) is the Union-Find
    instance.  We return the (possibly mutated) state alongside an event
    dict describing what happened.
    """
    uf = state if state is not None else UnionFind()
    u, v = edge["u"], edge["v"]
    merged, new_size = uf.union(u, v)
    if merged:
        event: Dict[str, Any] = {
            "u": u,
            "v": v,
            "status": "merged",
            "new_component_size": new_size,
        }
    else:
        event = {
            "u": u,
            "v": v,
            "status": "already_connected",
            "component_size": new_size,
        }
    return uf, event


# Build the dataflow at import time so the Bytewax CLI can pick it up via
# ``pipeline.py:flow``.
flow = Dataflow("connected_components")


# 1. Read edges from the input JSONL file (one JSON object per line).
edges_raw = op.input("input", flow, FileSource(INPUT_PATH))

# 2. Parse each JSON line into a dict.
edges = op.map("parse", edges_raw, _parse_edge)

# 3. Funnel every edge into a single stateful partition via a constant key.
keyed = op.key_on("route", edges, lambda _edge: ROUTING_KEY)

# 4. Maintain the Union-Find state for that single partition.
stateful = op.stateful_map("union_find", keyed, _process_edge)

# 5. Format each event as a JSON line for the sink.
serialized = op.map_value("format", stateful, _format_event)

# 6. Write to the output JSONL file.  ``FileSink`` is a
#    ``FixedPartitionedSink``; the constant routing key above maps every
#    event to partition 0 (the single output file) so order is preserved.
op.output("output", serialized, FileSink(OUTPUT_PATH))


if __name__ == "__main__":
    # Allow running the module directly for quick smoke tests.
    from bytewax.testing import run_main

    run_main(flow)
    # When run outside the orchestrated environment, list the output.
    print(f"Wrote events to {OUTPUT_PATH}")