"""Bytewax dataflow that computes the moving average of sensor temperature
readings.

Input  : ``input.csv``  -- lines of ``sensor_id,temperature``
Output : ``output.csv`` -- lines of ``sensor_id,moving_average``

The moving average is taken over the last 3 readings for each distinct
sensor.  When a sensor has fewer than 3 readings the average of the
available readings is emitted.  The result is rounded to exactly two
decimal places.

Run with::

    python -m bytewax.run pipeline:flow
"""

from collections import deque
from typing import List, Optional, Tuple

from bytewax.dataflow import Dataflow
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition
import bytewax.operators as op


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

INPUT_PATH = "input.csv"
OUTPUT_PATH = "output.csv"

# Sliding window size used for the moving average.
WINDOW_SIZE = 3


# ---------------------------------------------------------------------------
# Input:  read ``sensor_id,temperature`` lines from a CSV file.
# ---------------------------------------------------------------------------


class CSVSource(FixedPartitionedSource):
    """Fixed partitioned source that streams rows from a CSV file.

    Each row is emitted as a ``(sensor_id, temperature)`` tuple where
    ``sensor_id`` is a ``str`` and ``temperature`` is a ``float``.  Keys
    are strings as required by the downstream operators.
    """

    def __init__(self, path: str) -> None:
        self._path = path

    def list_parts(self) -> List[str]:
        # A single partition is enough for a local file; the dataflow
        # runs in-process with a single worker for this task.
        return ["singleton"]

    def build_part(
        self,
        step_id: str,
        for_part: str,
        resume_state: Optional[int],
    ) -> "_CSVSourcePartition":
        return _CSVSourcePartition(self._path, resume_state)


class _CSVSourcePartition(StatefulSourcePartition):
    """Reads CSV lines and exposes them as ``(sensor_id, temperature)``."""

    def __init__(self, path: str, resume_state: Optional[int]) -> None:
        self._path = path
        self._file = open(path, "r")
        self._lines_read = 0
        # If we are resuming from a snapshot, skip past the rows that
        # were already emitted.
        if resume_state is not None:
            for _ in range(resume_state):
                self._file.readline()
            self._lines_read = resume_state

    def next_batch(self):
        # Return one item per batch so downstream keyed operators
        # preserve the original input order.
        while True:
            line = self._file.readline()
            if not line:
                # End of file.  Signal to Bytewax that this partition
                # is exhausted so the dataflow can shut down.
                raise StopIteration()
            stripped = line.strip()
            if not stripped:
                # Skip blank lines without advancing the resume state.
                continue
            sensor_id, temp_str = stripped.split(",", 1)
            self._lines_read += 1
            return [(sensor_id.strip(), float(temp_str.strip()))]

    def snapshot(self) -> int:
        # Return the number of data lines successfully emitted so that
        # recovery can skip them on resume.
        return self._lines_read

    def close(self) -> None:
        self._file.close()


# ---------------------------------------------------------------------------
# Output: write ``sensor_id,moving_average`` lines to a CSV file.
# ---------------------------------------------------------------------------


class CSVSink(DynamicSink):
    """Dynamic sink that appends ``(sensor_id, value)`` rows to a file.

    Only worker ``0`` opens the file in write (truncate) mode; the
    remaining workers write to ``/dev/null`` so they are no-ops.  This
    avoids race conditions when the dataflow happens to run with more
    than one worker.
    """

    def __init__(self, path: str) -> None:
        self._path = path

    def build(
        self,
        step_id: str,
        worker_index: int,
        worker_count: int,
    ) -> "_CSVSinkPartition":
        if worker_index == 0:
            return _CSVSinkPartition(self._path)
        return _CSVSinkPartition("/dev/null")


class _CSVSinkPartition(StatelessSinkPartition):
    def __init__(self, path: str) -> None:
        self._path = path
        self._file = open(path, "w")

    def write_batch(self, items) -> None:
        for item in items:
            sensor_id, moving_average = item
            self._file.write(f"{sensor_id},{moving_average}\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()


# ---------------------------------------------------------------------------
# Stateful logic
# ---------------------------------------------------------------------------


def moving_average(state, value):
    """Return a new state and the formatted moving average.

    ``state`` is either ``None`` (first observation for this key) or a
    ``deque`` of recent temperature floats for the sensor.  A *new*
    deque is returned every call so the snapshot machinery can rely on
    immutability.
    """
    if state is None:
        # First observation: start with an empty deque.
        new_state = deque()
    else:
        # Copy the existing deque so we never mutate the persisted state.
        new_state = deque(state)

    new_state.append(float(value))
    while len(new_state) > WINDOW_SIZE:
        new_state.popleft()

    avg = sum(new_state) / len(new_state)
    formatted = f"{avg:.2f}"
    return (new_state, formatted)


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------


flow = Dataflow("moving_average")
inp = op.input("csv_in", flow, CSVSource(INPUT_PATH))
# ``inp`` is already a keyed stream of ``(sensor_id: str, temperature: float)``.
averaged = op.stateful_map("moving_avg", inp, moving_average)
# ``averaged`` is a keyed stream of ``(sensor_id, formatted_average_str)``.
op.output("csv_out", averaged, CSVSink(OUTPUT_PATH))