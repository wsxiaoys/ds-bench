"""Streaming Connected Components with Bytewax.

This pipeline reads a stream of undirected edges from a JSONL file and
dynamically maintains the connected components of the graph using a
Union-Find (Disjoint Set) data structure.  For every edge an event is
emitted describing whether the two endpoints were already connected or
were merged into a larger component.

Run with SQLite recovery enabled::

    python -m bytewax.recovery /home/user/graph_pipeline/recovery_db 1
    python -m bytewax.run \\
        /home/user/graph_pipeline/pipeline:flow \\
        -r /home/user/graph_pipeline/recovery_db \\
        -s 10 \\
        -b 20
"""

import json
from pathlib import Path
from typing import Dict, Optional, Tuple

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PIPELINE_DIR = Path("/home/user/graph_pipeline")
INPUT_PATH = PIPELINE_DIR / "input_edges.jsonl"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

# Read the run-id artifact so the output file is uniquely named per run.
RUN_ID = RUN_ID_PATH.read_text().strip()
OUTPUT_PATH = PIPELINE_DIR / f"output_events_{RUN_ID}.jsonl"

# A constant key guarantees that every edge is routed to the *same*
# stateful partition.  Union-Find needs a global view of the graph, so
# parallelism across keys would break correctness.
UNION_FIND_KEY = "UNION_FIND"


# ---------------------------------------------------------------------------
# Union-Find (Disjoint Set) — fully picklable for SQLite recovery
# ---------------------------------------------------------------------------

class UnionFind:
    """Disjoint-set with union-by-rank and path compression.

    Only plain ``dict`` attributes are used so the whole structure is
    trivially picklable — a hard requirement for Bytewax's SQLite
    recovery which serialises state snapshots with ``pickle``.
    """

    __slots__ = ("parent", "rank", "size")

    def __init__(self) -> None:
        self.parent: Dict[str, str] = {}   # node -> parent
        self.rank: Dict[str, int] = {}     # node -> rank (meaningful for roots)
        self.size: Dict[str, int] = {}     # node -> component size (roots only)

    def _ensure(self, x: str) -> None:
        """Lazily register a node the first time it is seen."""
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
            self.size[x] = 1

    def find(self, x: str) -> str:
        """Return the root representative of *x* with path compression."""
        self._ensure(x)
        # Walk up to the root.
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        # Compress the path so future queries are O(1).
        node = x
        while self.parent[node] != root:
            self.parent[node], node = root, self.parent[node]
        return root

    def union(self, root_u: str, root_v: str) -> str:
        """Merge the two trees rooted at *root_u* / *root_v*.

        Returns the new root of the merged tree.
        """
        if root_u == root_v:
            return root_u
        # Attach the shorter tree under the taller one.
        if self.rank[root_u] < self.rank[root_v]:
            root_u, root_v = root_v, root_u
        self.parent[root_v] = root_u
        self.size[root_u] += self.size[root_v]
        if self.rank[root_u] == self.rank[root_v]:
            self.rank[root_u] += 1
        return root_u

    def component_size(self, root: str) -> int:
        """Size of the component whose root is *root*."""
        return self.size[root]


# ---------------------------------------------------------------------------
# Operator functions
# ---------------------------------------------------------------------------

def parse_edge(line: str) -> dict:
    """Parse a JSONL line into an ``{"u", "v"}`` dict."""
    return json.loads(line)


def union_find_mapper(
    state: Optional[UnionFind], edge: dict
) -> Tuple[UnionFind, str]:
    """Stateful mapper that updates the Union-Find and emits an event.

    :arg state: The current :class:`UnionFind`, or ``None`` on the very
        first call for this key.
    :arg edge: ``{"u": str, "v": str}``
    :returns: ``(updated_state, event_json_string)``.
    """
    if state is None:
        state = UnionFind()

    u = edge["u"]
    v = edge["v"]

    root_u = state.find(u)
    root_v = state.find(v)

    if root_u == root_v:
        # Both endpoints already belong to the same component.
        event = {
            "u": u,
            "v": v,
            "status": "already_connected",
            "component_size": state.component_size(root_u),
        }
    else:
        # Merge the two distinct components.
        new_root = state.union(root_u, root_v)
        event = {
            "u": u,
            "v": v,
            "status": "merged",
            "new_component_size": state.component_size(new_root),
        }

    return state, json.dumps(event)


# ---------------------------------------------------------------------------
# Dataflow definition
# ---------------------------------------------------------------------------

flow = Dataflow("connected_components")

# 1. Read raw JSONL lines from the input file.  A batch size of 1 keeps
#    the processing strictly in-order, which is essential for a
#    deterministic Union-Find build-up.
lines = op.input("read_edges", flow, FileSource(str(INPUT_PATH), batch_size=1))

# 2. Parse each line into a dict.
edges = op.map("parse_edges", lines, parse_edge)

# 3. Route every edge to a single stateful partition via a constant key.
keyed = op.key_on("key_all", edges, lambda _edge: UNION_FIND_KEY)

# 4. Maintain the Union-Find state and emit one component event per edge.
#    The output is a keyed stream of (UNION_FIND_KEY, json_string) which
#    is exactly the (key, value) format that FileSink (a
#    FixedPartitionedSink) expects for routing.
events = op.stateful_map("union_find", keyed, union_find_mapper)

# 5. Write the events to the output file (one JSON object per line).
op.output("write_events", events, FileSink(str(OUTPUT_PATH)))