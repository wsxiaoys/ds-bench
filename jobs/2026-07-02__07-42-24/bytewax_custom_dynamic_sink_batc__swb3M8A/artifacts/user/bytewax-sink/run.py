import json
import os
from typing import List
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.outputs import StatelessSinkPartition, DynamicSink
from bytewax.testing import TestingSource

# Read run-id
RUN_ID_PATH = "/logs/artifacts/run-id"
if os.path.exists(RUN_ID_PATH):
    with open(RUN_ID_PATH, "r") as f:
        RUN_ID = f.read().strip()
else:
    RUN_ID = "default-run-id"

class FileRotatorSinkPartition(StatelessSinkPartition[int]):
    def __init__(self, run_id: str, worker_index: int, out_dir: str = "/home/user/bytewax-sink/out"):
        self.run_id = run_id
        self.worker_index = worker_index
        self.out_dir = out_dir
        self.current_part = 0
        self.current_file_records = 0
        self.current_file = None
        
        # Ensure output directory exists
        os.makedirs(self.out_dir, exist_ok=True)
        
    def _get_filepath(self, part: int) -> str:
        return os.path.join(
            self.out_dir,
            f"output-{self.run_id}-worker-{self.worker_index}-part-{part}.jsonl"
        )
        
    def _open_next_file(self):
        if self.current_file is not None:
            self.current_file.close()
        filepath = self._get_filepath(self.current_part)
        self.current_file = open(filepath, "w")
        self.current_file_records = 0
        
    def write_batch(self, items: List[int]) -> None:
        for item in items:
            if self.current_file is None:
                self._open_next_file()
                
            record = {"worker": self.worker_index, "value": item}
            self.current_file.write(json.dumps(record) + "\n")
            self.current_file_records += 1
            
            if self.current_file_records == 20:
                self.current_file.close()
                self.current_file = None
                self.current_part += 1
                
    def close(self) -> None:
        if self.current_file is not None:
            self.current_file.close()
            self.current_file = None

class FileRotatorSink(DynamicSink[int]):
    def __init__(self, run_id: str, out_dir: str = "/home/user/bytewax-sink/out"):
        self.run_id = run_id
        self.out_dir = out_dir
        
    def build(self, step_id: str, worker_index: int, worker_count: int) -> FileRotatorSinkPartition:
        return FileRotatorSinkPartition(self.run_id, worker_index, self.out_dir)

# Define the dataflow
flow = Dataflow("flow")

# Input stream of 200 integers
stream = op.input("input", flow, TestingSource(range(200)))

# Redistribute stream across workers to ensure parallel processing
redistributed_stream = op.redistribute("redistribute", stream)

# Output stream using our custom sink
op.output("output", redistributed_stream, FileRotatorSink(RUN_ID))
