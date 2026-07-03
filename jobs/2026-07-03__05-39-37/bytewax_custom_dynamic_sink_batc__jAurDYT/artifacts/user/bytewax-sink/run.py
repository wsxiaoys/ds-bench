"""Bytewax dataflow with a custom DynamicSink that performs file rotation.

Each worker writes the integers it receives to JSONL files, rotating to a new
"part" file once exactly ``RECORDS_PER_FILE`` records have been written. A
single ``write_batch`` call may span multiple files because the runtime hands
us arbitrarily-sized batches.
"""

import json
import os
from typing import List

from bytewax.dataflow import Dataflow
import bytewax.operators as ops
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax.testing import TestingSource

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
RECORDS_PER_FILE = 20
NUM_ITEMS = 200
OUTPUT_DIR = "/home/user/bytewax-sink/out"
RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id() -> str:
    """Read the run-id from the artifacts directory."""
    with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
        return fh.read().strip()


# ---------------------------------------------------------------------------
# Sink partition
# ---------------------------------------------------------------------------
class RotatingFileSinkPartition(StatelessSinkPartition[int]):
    """Writes integers to rotating JSONL files for a single worker.

    Files are named ``output-<run-id>-worker-<worker_index>-part-<n>.jsonl``
    and each file holds *exactly* ``RECORDS_PER_FILE`` records (except possibly
    the last file for this worker, which may hold fewer).

    A single ``write_batch`` call may receive a list larger than the remaining
    space in the current file, so we slice the batch across as many files as
    needed.
    """

    def __init__(self, worker_index: int, run_id: str, output_dir: str) -> None:
        self._worker_index = worker_index
        self._run_id = run_id
        self._output_dir = output_dir

        self._part = 0          # current part number (0-indexed)
        self._count = 0         # records written to the current part file
        self._fh = None         # lazily-opened file handle for the current part

    # -- file helpers -------------------------------------------------------
    def _file_path(self, part: int) -> str:
        return os.path.join(
            self._output_dir,
            f"output-{self._run_id}-worker-{self._worker_index}-part-{part}.jsonl",
        )

    def _ensure_open(self) -> None:
        """Open the current part file lazily when there is data to write."""
        if self._fh is None:
            os.makedirs(self._output_dir, exist_ok=True)
            self._fh = open(self._file_path(self._part), "a", encoding="utf-8")

    def _rotate(self) -> None:
        """Close the current part file and advance to the next part number."""
        if self._fh is not None:
            self._fh.flush()
            self._fh.close()
            self._fh = None
        self._part += 1
        self._count = 0

    # -- StatelessSinkPartition API ----------------------------------------
    def write_batch(self, items: List[int]) -> None:
        """Write a batch of integers, rotating files every 20 records.

        ``items`` may be of any size, so we consume it in slices that fit the
        remaining capacity of the current file, rotating as needed.
        """
        remaining = list(items)
        while remaining:
            self._ensure_open()
            space = RECORDS_PER_FILE - self._count
            chunk = remaining[:space]
            remaining = remaining[space:]

            for value in chunk:
                record = {"worker": self._worker_index, "value": value}
                self._fh.write(json.dumps(record) + "\n")

            self._count += len(chunk)
            if self._count >= RECORDS_PER_FILE:
                self._rotate()

    def close(self) -> None:
        """Flush and close the current part file on shutdown."""
        if self._fh is not None:
            self._fh.flush()
            self._fh.close()
            self._fh = None


# ---------------------------------------------------------------------------
# Sink
# ---------------------------------------------------------------------------
class RotatingFileSink(DynamicSink):
    """A DynamicSink that builds a rotating-file partition per worker."""

    def __init__(self, run_id: str, output_dir: str = OUTPUT_DIR) -> None:
        self._run_id = run_id
        self._output_dir = output_dir

    def build(self, step_id: str, worker_index: int, worker_count: int):
        return RotatingFileSinkPartition(
            worker_index=worker_index,
            run_id=self._run_id,
            output_dir=self._output_dir,
        )


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------
def build_flow() -> Dataflow:
    run_id = _read_run_id()

    flow = Dataflow("bytewax-sink")

    # Generate 200 integers (0..199). TestingSource has a single partition, so
    # only one worker reads them initially.
    nums = ops.input("in", flow, TestingSource(list(range(NUM_ITEMS))))

    # Spread the items across all 4 workers so each one writes its own files.
    nums = ops.redistribute("redistribute", nums)

    # Write to the rotating-file sink.
    sink = RotatingFileSink(run_id=run_id, output_dir=OUTPUT_DIR)
    ops.output("out", nums, sink)

    return flow


# Module-level variable discovered by `python -m bytewax.run run:flow`.
flow = build_flow()