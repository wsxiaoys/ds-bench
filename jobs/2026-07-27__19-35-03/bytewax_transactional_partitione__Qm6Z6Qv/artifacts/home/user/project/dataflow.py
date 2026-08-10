import os
import json
from typing import List, Optional, Iterable, Tuple
from datetime import datetime
from bytewax.outputs import FixedPartitionedSink, StatefulSinkPartition
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.dataflow import Dataflow
import bytewax.operators as op

class JSONSourcePartition(StatefulSourcePartition[dict, int]):
    def __init__(self, resume_state: Optional[int]):
        with open("/home/user/project/events.json", "r") as f:
            self._events = json.load(f)
        self._index = resume_state if resume_state is not None else 0

    def next_batch(self) -> Iterable[dict]:
        if self._index >= len(self._events):
            raise StopIteration()
        item = self._events[self._index]
        self._index += 1
        return [item]

    def snapshot(self) -> int:
        return self._index

    def next_awake(self) -> Optional[datetime]:
        return None

class JSONSource(FixedPartitionedSource[dict, int]):
    def list_parts(self) -> List[str]:
        return ["single"]

    def build_part(self, step_id: str, for_part: str, resume_state: Optional[int]) -> StatefulSourcePartition[dict, int]:
        return JSONSourcePartition(resume_state)

class FileSinkPartition(StatefulSinkPartition[dict, int]):
    def __init__(self, part_id: str, resume_state: Optional[int]):
        self.part_id = part_id
        self.out_dir = "/home/user/project/out"
        os.makedirs(self.out_dir, exist_ok=True)
        self.file_path = os.path.join(self.out_dir, f"part-{part_id}.jsonl")
        
        if resume_state is not None:
            try:
                self._file = open(self.file_path, "r+b")
                self._file.truncate(resume_state)
                self._file.seek(resume_state)
            except FileNotFoundError:
                self._file = open(self.file_path, "w+b")
        else:
            self._file = open(self.file_path, "w+b")

    def write_batch(self, values: List[dict]) -> None:
        for val in values:
            seq = val["seq"]
            crash_at = os.environ.get("CRASH_AT")
            if crash_at:
                try:
                    crash_n = int(crash_at)
                    if seq == crash_n:
                        self._file.flush()
                        os.fsync(self._file.fileno())
                        os._exit(1)
                except ValueError:
                    pass

            line = json.dumps(val) + "\n"
            self._file.write(line.encode("utf-8"))
            self._file.flush()
            os.fsync(self._file.fileno())

    def snapshot(self) -> int:
        self._file.flush()
        os.fsync(self._file.fileno())
        return self._file.tell()

    def close(self) -> None:
        if hasattr(self, "_file") and self._file is not None:
            self._file.close()

class FileSink(FixedPartitionedSink[dict, int]):
    def list_parts(self) -> List[str]:
        return ["0", "1", "2", "3"]

    def build_part(self, step_id: str, for_part: str, resume_state: Optional[int]) -> StatefulSinkPartition[dict, int]:
        return FileSinkPartition(for_part, resume_state)

flow = Dataflow("flow")

# Source
events = op.input("input_step", flow, JSONSource())

# Key on the key field
keyed_events = op.key_on("key_events", events, lambda x: x["key"])

# Stateful cumulative running sum of value
def check(running_total: Optional[int], item: dict) -> Tuple[Optional[int], dict]:
    if running_total is None:
        running_total = 0
    running_total += item["value"]
    output_record = {
        "seq": item["seq"],
        "key": item["key"],
        "value": item["value"],
        "running_total": running_total,
    }
    return (running_total, output_record)

running_sums = op.stateful_map("running_sums", keyed_events, check)

# Sink
op.output("output_step", running_sums, FileSink())
