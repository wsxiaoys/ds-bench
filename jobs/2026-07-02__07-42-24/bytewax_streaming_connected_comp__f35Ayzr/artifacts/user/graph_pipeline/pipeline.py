import json
import os
from pathlib import Path
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.connectors.files import FileSource, FileSink

class UnionFind:
    def __init__(self):
        # parent maps each node to its parent node
        self.parent = {}
        # size maps each root node to the size of its component
        self.size = {}

    def find(self, i):
        if i not in self.parent:
            self.parent[i] = i
            self.size[i] = 1
            return i
        
        # Path compression
        curr = i
        path = []
        while self.parent[curr] != curr:
            path.append(curr)
            curr = self.parent[curr]
        for node in path:
            self.parent[node] = curr
        return curr

    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)

        if root_i == root_j:
            return False, self.size[root_i]

        # Union by size
        if self.size[root_i] < self.size[root_j]:
            root_i, root_j = root_j, root_i

        self.parent[root_j] = root_i
        self.size[root_i] += self.size[root_j]
        return True, self.size[root_i]

# Build the Bytewax Dataflow
flow = Dataflow("connected_components")

# Input: Read lines from the input file
input_path = "/home/user/graph_pipeline/input_edges.jsonl"
stream = op.input("input_edges", flow, FileSource(input_path))

# Parse JSON strings to dictionaries
stream = op.map("parse_json", stream, json.loads)

# Route all edges to a single stateful partition using a constant key
stream = op.key_on("constant_key", stream, lambda edge: "global")

# Stateful Map to maintain connected components
def update_components(state, edge):
    if state is None:
        state = UnionFind()
    
    u = edge["u"]
    v = edge["v"]
    merged, size = state.union(u, v)
    
    if merged:
        emit_val = {
            "u": u,
            "v": v,
            "status": "merged",
            "new_component_size": size
        }
    else:
        emit_val = {
            "u": u,
            "v": v,
            "status": "already_connected",
            "component_size": size
        }
    
    return (state, emit_val)

stream = op.stateful_map("union_find", stream, update_components)

# Remove the constant key
stream = op.map("remove_key", stream, lambda key_val: key_val[1])

# Serialize output dictionaries to JSON strings
stream = op.map("serialize_json", stream, json.dumps)

# Read run-id dynamically to construct the output path
run_id_file = "/logs/artifacts/run-id"
if os.path.exists(run_id_file):
    with open(run_id_file, "r") as f:
        run_id = f.read().strip()
else:
    run_id = "default"

output_path = f"/home/user/graph_pipeline/output_events_{run_id}.jsonl"

# Key the stream for FileSink
stream = op.key_on("sink_key", stream, lambda x: output_path)

# Output: Write lines to the output file
op.output("output_events", stream, FileSink(Path(output_path)))
