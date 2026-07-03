"""Bytewax dataflow that computes running maximums per key with persistence.

The dataflow:
1. Reads a CSV file containing `key,value` pairs from the path provided
   via the ``input_file`` argument.
2. Computes the running maximum of the ``value`` for each distinct ``key``
   using a stateful ``stateful_map`` operator.
3. Persists the running-maximum state to a SQLite-based recovery store so
   that the running maximums survive across separate executions of the
   dataflow.

The output is written to the path provided via ``output_file`` in the
format ``key,running_max``.

For the recovery mechanism to work properly the stateful operator uses
the stable, unique step id ``"running_max"``.  Whenever the dataflow is
restarted against the same recovery directory the state stored under
this step id is restored, so previously seen keys keep their
historic maximums.

Because the input file path can legitimately change between runs (the
pipeline is designed to consume any number of input files in sequence),
the dataflow ships a small pair of file connectors that expose a
*stable* partition id (``"running_max_source"`` and
``"running_max_sink"``).  This keeps the source/sink partitions
registered with the recovery store identical across executions while
still allowing the underlying file paths to vary.
"""

from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from typing_extensions import override

from bytewax.dataflow import Dataflow
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import FixedPartitionedSink, StatefulSinkPartition
import bytewax.operators as op


# Stable partition identifiers.  Using constants here means the recovery
# store always sees the same partition list regardless of the actual
# file paths used at runtime, which in turn means the ``stateful_map``
# state can be cleanly recovered while still allowing fresh files to be
# passed in on each invocation.
INPUT_PARTITION = "running_max_source"
OUTPUT_PARTITION = "running_max_sink"


# ---------------------------------------------------------------------------
# Custom CSV file source with a stable partition id.
# ---------------------------------------------------------------------------


class _CsvFilePartition(StatefulSourcePartition[Dict[str, str], Tuple[str, int]]):
    """A CSV source partition backed by a single file.

    The partition state is ``(resolved_path, offset)``.  When the
    dataflow is resumed we look at the path saved in the recovery
    store and compare it to the path of the file we are being asked
    to read now.  If the paths differ we deliberately restart from the
    beginning of the *new* file so that the user can keep the same
    recovery directory across invocations while still feeding in
    different input files.
    """

    def __init__(
        self,
        path: Path,
        batch_size: int,
        resume_state: Optional[Tuple[str, int]],
    ):
        self._path = path
        self._batch_size = batch_size
        # Resolve the path so equivalent paths (different cwd,
        # ``./foo`` vs absolute, etc.) compare equal.
        self._resolved_path = str(path.resolve())

        if (
            resume_state is not None
            and len(resume_state) == 2
            and resume_state[0] == self._resolved_path
        ):
            start_offset = max(int(resume_state[1]), 0)
        else:
            # First time we see this file (or a different file), start
            # from the very beginning.
            start_offset = 0

        self._f = open(self._path, "rt", newline="")
        # Honour the saved offset if it is still within the file.
        try:
            file_size = os.path.getsize(self._path)
        except OSError:
            file_size = 0
        if start_offset > file_size:
            start_offset = 0
        try:
            self._f.seek(start_offset)
        except OSError:
            self._f.seek(0)
            start_offset = 0
        self._offset = start_offset
        self._reader = csv.DictReader(self._f)

    @override
    def next_batch(self) -> List[Dict[str, str]]:
        batch: List[Dict[str, str]] = []
        for _ in range(self._batch_size):
            try:
                row = next(self._reader)
            except StopIteration:
                # We have hit EOF.  If we already collected some rows we
                # return them now; the next call to ``next_batch`` will
                # have nothing left to give and we let the dataflow
                # runtime mark the partition as exhausted.
                if batch:
                    return batch
                raise
            batch.append(row)
        return batch

    @override
    def snapshot(self) -> Tuple[str, int]:
        # Capture both the file path and the current offset so the next
        # resume can tell whether we are being asked to read the same
        # file again or a different one.
        try:
            offset = self._f.tell()
        except (OSError, ValueError):
            offset = self._offset
        return (self._resolved_path, offset)

    @override
    def close(self) -> None:
        try:
            self._f.close()
        except Exception:  # pragma: no cover - cleanup best-effort
            pass


class CSVFileSource(FixedPartitionedSource[Dict[str, str], Tuple[str, int]]):
    """Read a CSV file row-by-row using a stable partition id.

    Each instance advertises exactly one partition whose id is the
    constant ``INPUT_PARTITION``.  This keeps the recovery store happy
    even when the dataflow is re-instantiated against a different file
    on disk.
    """

    def __init__(self, path: str | os.PathLike[str], batch_size: int = 1000):
        self._path = Path(path)
        self._batch_size = batch_size

    @override
    def list_parts(self) -> List[str]:
        if self._path.exists():
            return [INPUT_PARTITION]
        return []

    @override
    def build_part(
        self,
        step_id: str,
        for_part: str,
        resume_state: Optional[Tuple[str, int]],
    ) -> _CsvFilePartition:
        if for_part != INPUT_PARTITION:
            raise ValueError(
                f"Unexpected partition id {for_part!r}; expected {INPUT_PARTITION!r}"
            )
        return _CsvFilePartition(self._path, self._batch_size, resume_state)


# ---------------------------------------------------------------------------
# Custom appending file sink with a stable partition id.
# ---------------------------------------------------------------------------


class _AppendFileSinkPartition(StatefulSinkPartition[str, Tuple[str, int]]):
    """A sink partition that appends events to a single file."""

    def __init__(self, path: Path, resume_state: Optional[Tuple[str, int]]):
        self._path = path
        self._resolved_path = str(path.resolve())
        # We open in append mode so events are always written to the
        # end of the file - this matches the natural "running log"
        # semantics of the running-max pipeline.
        self._f = open(self._path, "a")
        self._f.seek(0, os.SEEK_END)
        self._offset: int = self._f.tell()
        # The ``resume_state`` is informational only - if the previous
        # snapshot was for a different file we simply discard the
        # saved offset and start writing to the new file from scratch.
        if (
            resume_state is not None
            and len(resume_state) == 2
            and resume_state[0] == self._resolved_path
        ):
            self._offset = int(resume_state[1])

    @override
    def write_batch(self, values: List[str]) -> None:
        for value in values:
            self._f.write(value)
            self._f.write("\n")
        self._f.flush()
        try:
            os.fsync(self._f.fileno())
        except OSError:  # pragma: no cover - some filesystems don't support fsync
            pass

    @override
    def snapshot(self) -> Tuple[str, int]:
        try:
            offset = self._f.tell()
        except (OSError, ValueError):
            offset = self._offset
        return (self._resolved_path, offset)

    @override
    def close(self) -> None:
        try:
            self._f.close()
        except Exception:  # pragma: no cover - cleanup best-effort
            pass


class AppendFileSink(FixedPartitionedSink[str, Tuple[str, int]]):
    """Append events to a single file using a stable partition id.

    The sink advertises a single partition (``OUTPUT_PARTITION``) so the
    recovery store always sees the same partition list regardless of
    the destination file path used at runtime.
    """

    def __init__(self, path: str | os.PathLike[str]):
        self._path = Path(path)

    @override
    def list_parts(self) -> List[str]:
        return [OUTPUT_PARTITION]

    @override
    def part_fn(self, item_key: str) -> int:
        return 0

    @override
    def build_part(
        self,
        step_id: str,
        for_part: str,
        resume_state: Optional[Tuple[str, int]],
    ) -> _AppendFileSinkPartition:
        if for_part != OUTPUT_PARTITION:
            raise ValueError(
                f"Unexpected partition id {for_part!r}; expected {OUTPUT_PARTITION!r}"
            )
        return _AppendFileSinkPartition(self._path, resume_state)


# ---------------------------------------------------------------------------
# Dataflow definition.
# ---------------------------------------------------------------------------


def _parse_row(row: Dict[str, str]) -> Optional[Any]:
    """Convert a CSV dict to a ``(key, value)`` tuple.

    Returns ``None`` for malformed rows so that the upstream
    ``filter`` operator can drop them.
    """
    try:
        key = row["key"]
        value = int(row["value"])
    except (KeyError, TypeError, ValueError):
        return None
    if key == "":
        return None
    return (str(key), int(value))


def _running_max(state: Optional[int], item: Any):
    """Compute the new running max for a key."""
    _key, value = item
    if state is None:
        new_state = value
    else:
        new_state = state if state >= value else value
    return new_state, new_state


def get_flow(input_file: str, output_file: str) -> Dataflow:
    """Build and return the running-maximum dataflow.

    The function takes the input and output file paths as arguments so
    that ``python -m bytewax.run`` can instantiate the dataflow via its
    ``module:function('arg1', 'arg2')`` syntax.

    Args:
        input_file: Path to a CSV file whose rows look like
            ``key,value`` where ``value`` is an integer.
        output_file: Path where the running-max CSV events
            (``key,running_max``) should be written / appended.
    """
    flow = Dataflow("bytewax_recovery_running_max")

    # 1. Input - read the CSV file row by row.
    source = CSVFileSource(input_file)
    rows = op.input("in", flow, source)

    # 2. Parse each row into a ``(key, value)`` tuple, dropping bad rows.
    parsed = op.map("parse", rows, _parse_row)
    parsed = op.filter("drop_bad_rows", parsed, lambda item: item is not None)

    # 3. Key the stream by the ``key`` column so that the stateful
    #    operator below sees one partition per key.
    keyed = op.key_on("by_key", parsed, lambda item: item[0])

    # 4. Stateful running-max per key.  The unique step id
    #    ``"running_max"`` is what enables Bytewax to recover the
    #    per-key state across runs.
    maxed = op.stateful_map("running_max", keyed, _running_max)

    # 5. Format each event as ``key,running_max`` for the sink.
    formatted = op.map(
        "format",
        maxed,
        lambda item: f"{item[0]},{item[1]}",
    )

    # 6. ``op.output`` sinks expect a ``(key, value)`` tuple stream so
    #    they can decide which partition the event should go to.  We
    #    only ever have one partition so the key just needs to be
    #    constant - using the running-max key keeps things tidy.
    keyed_output = op.key_on("by_key_for_sink", formatted, lambda item: "out")
    op.output("out", keyed_output, AppendFileSink(output_file))

    return flow


# Make the dataflow conveniently accessible as ``flow:flow`` too.
# ``python -m bytewax.run flow:flow`` will resolve this attribute.
flow = None  # type: ignore[assignment]


def _build_default_flow() -> Dataflow:
    """Fallback factory used when no CLI args are passed."""
    return get_flow("input.csv", "output.csv")


#: Convenient module level export so ``flow:flow`` resolves at import
#: time when the module is loaded without factory arguments.  This is
#: not used by the normal ``run.sh`` invocation but makes the file
#: easier to inspect interactively.
try:  # pragma: no cover - convenience default only
    flow = _build_default_flow()
except Exception:
    flow = None
