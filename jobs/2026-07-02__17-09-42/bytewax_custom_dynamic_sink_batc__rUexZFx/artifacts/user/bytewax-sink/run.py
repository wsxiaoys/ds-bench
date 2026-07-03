"""Bytewax dataflow that writes integers to JSONL files with rotation.

Each worker writes to its own isolated files. A single file contains
exactly 20 records, except possibly the last file for a worker.
"""

import json
import os
from typing import Any, List, Optional, TextIO

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from bytewax.testing import TestingSource
from typing_extensions import override


# Read run-id from the artifacts directory.
_RUN_ID_PATH = "/logs/artifacts/run-id"
_OUTPUT_DIR = "/home/user/bytewax-sink/out"
_MAX_RECORDS_PER_FILE = 20


def _load_run_id(path: str = _RUN_ID_PATH) -> str:
    """Load the run-id from the given file, stripping whitespace."""
    with open(path, "r") as f:
        return f.read().strip()


class JSONLSinkPartition(StatelessSinkPartition[Any]):
    """A stateless partition that writes items to a JSONL file with rotation.

    The current file is rotated (closed and a new part opened) once it
    reaches ``_MAX_RECORDS_PER_FILE`` records. ``write_batch`` may receive
    a list of arbitrary size, so a single call can span multiple files.
    """

    def __init__(
        self,
        worker_index: int,
        output_dir: str,
        run_id: str,
        max_records: int = _MAX_RECORDS_PER_FILE,
    ) -> None:
        self._worker_index = worker_index
        self._output_dir = output_dir
        self._run_id = run_id
        self._max_records = max_records
        self._part_number = 0
        self._records_in_current_file = 0
        self._current_file: Optional[TextIO] = None

    def _current_path(self) -> str:
        return os.path.join(
            self._output_dir,
            (
                f"output-{self._run_id}-worker-{self._worker_index}"
                f"-part-{self._part_number}.jsonl"
            ),
        )

    def _open_current_file(self) -> None:
        os.makedirs(self._output_dir, exist_ok=True)
        self._current_file = open(self._current_path(), "w")
        self._records_in_current_file = 0

    def _close_current_file(self) -> None:
        if self._current_file is not None:
            self._current_file.close()
            self._current_file = None

    def _advance_after_full(self) -> None:
        """Called when the current file is full.

        Closes the file and advances ``_part_number`` so that the next
        write opens a fresh file rather than truncating the just-closed
        one.
        """
        self._close_current_file()
        self._part_number += 1
        self._records_in_current_file = 0

    @override
    def write_batch(self, items: List[Any]) -> None:
        for item in items:
            # Lazily open the current file the first time we need it.
            if self._current_file is None:
                self._open_current_file()
            # If the current file is full, close it and advance.
            if self._records_in_current_file >= self._max_records:
                self._advance_after_full()
                self._open_current_file()
            record = {"worker": self._worker_index, "value": item}
            assert self._current_file is not None
            self._current_file.write(json.dumps(record))
            self._current_file.write("\n")
            self._records_in_current_file += 1
        # End-of-batch: if the batch left the current file exactly full,
        # close it and advance ``_part_number`` so that the next call
        # (or any future open) goes to a new file instead of re-opening
        # and truncating the just-filled one.
        if (
            self._current_file is not None
            and self._records_in_current_file >= self._max_records
        ):
            self._advance_after_full()

    @override
    def close(self) -> None:
        # If the current file is full, close and advance before closing
        # the partition so any subsequent open goes to a new file.
        if (
            self._current_file is not None
            and self._records_in_current_file >= self._max_records
        ):
            self._advance_after_full()
        self._close_current_file()


class JSONLDynamicSink(DynamicSink[Any]):
    """A dynamic sink that creates one ``JSONLSinkPartition`` per worker.

    Because each worker writes to its own files (named with its
    ``worker_index``), there are no concurrent write conflicts.
    """

    def __init__(
        self,
        output_dir: str,
        run_id: str,
        max_records: int = _MAX_RECORDS_PER_FILE,
    ) -> None:
        self._output_dir = output_dir
        self._run_id = run_id
        self._max_records = max_records

    @override
    def build(
        self,
        _step_id: str,
        worker_index: int,
        _worker_count: int,
    ) -> JSONLSinkPartition:
        return JSONLSinkPartition(
            worker_index,
            self._output_dir,
            self._run_id,
            self._max_records,
        )


def build_flow(run_id: Optional[str] = None) -> Dataflow:
    """Construct the dataflow.

    ``run_id`` can be overridden for testing; by default we read it from
    ``/logs/artifacts/run-id``.
    """
    if run_id is None:
        run_id = _load_run_id()

    os.makedirs(_OUTPUT_DIR, exist_ok=True)

    flow = Dataflow("jsonl_sink")
    # ``TestingSource`` only consumes its iterable on a single worker, so
    # we use ``redistribute`` to spread items across all workers and
    # exercise the per-worker file naming/rotation logic in each.
    stream = op.input("inp", flow, TestingSource(range(200)))
    stream = op.redistribute("distribute", stream)
    op.output("out", stream, JSONLDynamicSink(_OUTPUT_DIR, run_id))
    return flow


# Module-level ``flow`` symbol required for ``python -m bytewax.run run:flow``.
flow = build_flow()


if __name__ == "__main__":
    # Allow running the script directly for quick sanity-checking.
    from bytewax.testing import run_main

    run_main(flow)