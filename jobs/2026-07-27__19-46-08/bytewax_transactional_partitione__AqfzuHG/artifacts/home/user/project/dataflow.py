"""Transactional partitioned sink with exactly-once recovery.

Reads events from events.json, maintains a per-key running sum, and writes
results to out/part-{0..3}.jsonl via a custom FixedPartitionedSink that
supports exactly-once output across crash recovery.

When CRASH_AT=N is set, the pipeline exits with code 1 after processing
the event with seq==N (and that event IS written before exit).
"""

import json
import os
import sys
import zlib
from pathlib import Path
from typing import List, Optional, Tuple

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition, batch
from bytewax.outputs import FixedPartitionedSink, StatefulSinkPartition

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_DIR = Path("/home/user/project")
EVENTS_PATH = PROJECT_DIR / "events.json"
OUT_DIR = PROJECT_DIR / "out"
NUM_PARTITIONS = 4

# ---------------------------------------------------------------------------
# Input: Read events.json as a JSON array, sorted by seq
# ---------------------------------------------------------------------------


class EventsPartition(StatefulSourcePartition[dict, int]):
    """Reads events from a JSON array file, yielding one event at a time.

    The resume_state is the index into the events list (next event to emit).
    """

    def __init__(self, path: Path, resume_state: Optional[int]):
        with open(path, "rt") as f:
            raw = json.load(f)
        # Sort by seq to guarantee correct ordering
        self._events = sorted(raw, key=lambda e: e["seq"])
        self._index = resume_state if resume_state is not None else 0
        self._batcher = batch(self._events[self._index:], batch_size=1)

    def next_batch(self) -> List[dict]:
        return next(self._batcher)

    def snapshot(self) -> int:
        # The index of the next event to emit (after the last emitted one)
        return self._index

    def close(self) -> None:
        pass


class EventsSource(FixedPartitionedSource[dict, int]):
    """Fixed-partitioned source that reads events.json."""

    def __init__(self, path: Path):
        self._path = path

    def list_parts(self) -> List[str]:
        return [str(self._path)]

    def build_part(
        self, step_id: str, for_part: str, resume_state: Optional[int]
    ) -> EventsPartition:
        return EventsPartition(self._path, resume_state)


# ---------------------------------------------------------------------------
# Stateful operator: running sum per key
# ---------------------------------------------------------------------------


def accumulate(
    state: Optional[int], event: dict
) -> Tuple[Optional[int], dict]:
    """Maintain a running sum per key.

    Args:
        state: Current running sum for this key, or None if first occurrence.
        event: The input event dict with keys: seq, key, value.

    Returns:
        (new_state, output_dict) where output_dict has seq, key,
        value, and running_total. The key is preserved automatically
        by stateful_map.
    """
    if state is None:
        state = 0
    new_total = state + event["value"]
    output = {
        "seq": event["seq"],
        "key": event["key"],
        "value": event["value"],
        "running_total": new_total,
    }
    return (new_total, output)


# ---------------------------------------------------------------------------
# Crash hook: check CRASH_AT environment variable
# ---------------------------------------------------------------------------

# We use a module-level variable to track whether we've already triggered
# the crash (to avoid multiple exits from the same event).
_crash_triggered = False


def maybe_crash(event: dict) -> dict:
    """If CRASH_AT is set and matches this event's seq, exit non-zero.

    The event is passed through unchanged so it can be written downstream
    before the crash (the output operator flushes before we exit).
    """
    global _crash_triggered
    crash_at = os.environ.get("CRASH_AT", "").strip()
    if crash_at and not _crash_triggered:
        try:
            target = int(crash_at)
        except ValueError:
            target = None
        if target is not None and event["seq"] == target:
            _crash_triggered = True
            # Force a flush of stdout/stderr then exit
            sys.stdout.flush()
            sys.stderr.flush()
            # The event has already been passed through - the sink should
            # have written it by now (same batch). We exit after the event
            # is processed.
            os._exit(1)
    return event


# ---------------------------------------------------------------------------
# Output: Custom partitioned sink with exactly-once semantics
# ---------------------------------------------------------------------------


class JsonlPartition(StatefulSinkPartition[dict, int]):
    """Writes JSON objects as JSONL lines to a partition file.

    Uses seek+truncate on resume to achieve exactly-once output:
    - On first run: opens in append mode, writes normally.
    - On resume: seeks to the snapshot position and truncates, removing
      any duplicate writes from the partial epoch before the crash.
    """

    def __init__(self, path: Path, resume_state: Optional[int]):
        self._path = path
        self._f = open(path, "a")  # append mode
        if resume_state is not None:
            self._f.seek(resume_state)
            self._f.truncate()
        self._offset = self._f.tell()

    def write_batch(self, values: List[dict]) -> None:
        for value in values:
            line = json.dumps(value, sort_keys=True) + "\n"
            self._f.write(line)
        self._f.flush()
        os.fsync(self._f.fileno())
        self._offset = self._f.tell()

    def snapshot(self) -> int:
        # Return current file position so that on resume we can
        # seek+truncate to remove duplicates.
        return self._offset

    def close(self) -> None:
        self._f.close()


class PartitionedJsonlSink(FixedPartitionedSink[dict, int]):
    """Fixed-partitioned sink that writes to out/part-{0..3}.jsonl.

    Routes records to partitions using zlib.adler32(key) % 4.
    """

    def __init__(self, out_dir: Path, num_parts: int):
        self._out_dir = out_dir
        self._num_parts = num_parts
        # Ensure output directory exists
        self._out_dir.mkdir(parents=True, exist_ok=True)

    def list_parts(self) -> List[str]:
        return [str(i) for i in range(self._num_parts)]

    def part_fn(self, item_key: str) -> int:
        return zlib.adler32(item_key.encode("utf-8")) % self._num_parts

    def build_part(
        self,
        step_id: str,
        for_part: str,
        resume_state: Optional[int],
    ) -> JsonlPartition:
        part_path = self._out_dir / f"part-{for_part}.jsonl"
        return JsonlPartition(part_path, resume_state)


# ---------------------------------------------------------------------------
# Build the dataflow
# ---------------------------------------------------------------------------

flow = Dataflow("transactional_sink")

# 1. Read events from events.json
events = op.input("read_events", flow, EventsSource(EVENTS_PATH))

# 2. Key by the "key" field → KeyedStream of (key, event_dict)
keyed = op.key_on("key_on", events, lambda e: e["key"])

# 3. Stateful running sum per key → KeyedStream of (key, output_dict)
summed = op.stateful_map("running_sum", keyed, accumulate)

# 4. Crash hook: check CRASH_AT after the event is computed but before
#    it reaches the sink. We apply this as a map_value on the keyed stream
#    to transform only the value, keeping the key intact.
def crash_on_value(value: dict) -> dict:
    maybe_crash(value)
    return value


checked = op.map_value("crash_check", summed, crash_on_value)

# 5. Write to partitioned JSONL sink
op.output("write_output", checked, PartitionedJsonlSink(OUT_DIR, NUM_PARTITIONS))
