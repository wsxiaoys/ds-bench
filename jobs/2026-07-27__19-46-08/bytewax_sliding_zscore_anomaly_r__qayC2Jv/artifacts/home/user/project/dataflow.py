"""
Bytewax dataflow for sliding-window z-score anomaly detection on sensor readings.
"""
import json
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional, Tuple

from bytewax.dataflow import Dataflow
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import FixedPartitionedSink, StatefulSinkPartition
import bytewax.operators as op
from bytewax.operators.windowing import (
    EventClock,
    SlidingWindower,
    WindowMetadata,
    WindowOut,
    fold_window,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INPUT_PATH = "/home/user/project/data/sensor_readings.jsonl"
PROFILES_PATH = "/home/user/project/output/profiles.jsonl"
ANOMALIES_PATH = "/home/user/project/output/anomalies.jsonl"

WINDOW_LENGTH = timedelta(seconds=60)
WINDOW_OFFSET = timedelta(seconds=30)
ALIGN_TO = datetime(1970, 1, 1, tzinfo=timezone.utc)

THRESHOLD = float(os.environ.get("ZSCORE_THRESHOLD", "3.0"))


# ---------------------------------------------------------------------------
# Input source
# ---------------------------------------------------------------------------

class SensorReadingSource(FixedPartitionedSource):
    """Reads sensor readings from a JSONL file, one partition."""

    def __init__(self, path: str):
        self.path = path

    def list_parts(self) -> List[str]:
        return ["0"]

    def build_part(
        self,
        step_id: str,
        for_part: str,
        resume_state: Optional[int],
    ) -> StatefulSourcePartition:
        return _SensorReadingPartition(self.path, resume_state)


class _SensorReadingPartition(StatefulSourcePartition):
    """A single partition that reads sensor readings from a JSONL file."""

    def __init__(self, path: str, resume_state: Optional[int]):
        self._file = open(path, "r")
        self._line_no = resume_state if resume_state is not None else 0
        for _ in range(self._line_no):
            self._file.readline()
        self._done = False

    def next_batch(self) -> Iterable[Tuple[str, int, float]]:
        if self._done:
            raise StopIteration()

        line = self._file.readline()
        if not line:
            self._done = True
            raise StopIteration()

        line = line.strip()
        self._line_no += 1
        if not line:
            return []

        obj = json.loads(line)
        sensor_id = obj["sensor_id"]
        dt = datetime.fromisoformat(obj["ts"])
        ts_epoch = int(dt.timestamp())
        value = obj["value"]
        return [(sensor_id, ts_epoch, value)]

    def snapshot(self) -> int:
        return self._line_no

    def close(self) -> None:
        self._file.close()


# ---------------------------------------------------------------------------
# Windowing helpers
# ---------------------------------------------------------------------------

def ts_getter(record: Tuple[str, int, float]) -> datetime:
    """Extract event-time datetime from a record."""
    _sensor_id, ts_epoch, _value = record
    return datetime.fromtimestamp(ts_epoch, tz=timezone.utc)


# Accumulator: list of (ts_epoch, value)
Accumulator = List[Tuple[int, float]]


def builder() -> Accumulator:
    return []


def folder(acc: Accumulator, record: Tuple[str, int, float]) -> Accumulator:
    _sensor_id, ts_epoch, value = record
    acc.append((ts_epoch, value))
    return acc


def merger(a: Accumulator, b: Accumulator) -> Accumulator:
    return a + b


# ---------------------------------------------------------------------------
# Statistics computation
# ---------------------------------------------------------------------------

def compute_stats(
    readings: List[Tuple[int, float]],
) -> Tuple[int, float, float, float]:
    """Compute (count, mean, population_variance, population_std)."""
    count = len(readings)
    if count == 0:
        return 0, 0.0, 0.0, 0.0

    values = [v for _, v in readings]
    mean = sum(values) / count
    variance = sum((v - mean) ** 2 for v in values) / count
    std = math.sqrt(variance)
    return count, mean, variance, std


def round6(value: float) -> float:
    return round(value, 6)


# ---------------------------------------------------------------------------
# Processing: compute profiles and anomalies from a closed window
# ---------------------------------------------------------------------------

def process_window(
    sensor_id: str,
    readings: List[Tuple[int, float]],
    window_start: datetime,
    window_end: datetime,
) -> Tuple[List[dict], List[dict]]:
    """Compute profile and anomaly records for a window."""
    count, mean, variance, std = compute_stats(readings)

    window_start_epoch = int(window_start.timestamp())
    window_end_epoch = int(window_end.timestamp())

    profiles = [
        {
            "sensor_id": sensor_id,
            "window_start": window_start_epoch,
            "window_end": window_end_epoch,
            "count": count,
            "mean": round6(mean),
            "variance": round6(variance),
            "std": round6(std),
        }
    ]

    anomalies = []
    for ts_epoch, value in readings:
        if std == 0.0:
            zscore = 0.0
        else:
            zscore = (value - mean) / std

        if abs(zscore) > THRESHOLD:
            anomalies.append(
                {
                    "sensor_id": sensor_id,
                    "ts": ts_epoch,
                    "value": value,
                    "window_start": window_start_epoch,
                    "zscore": round6(zscore),
                }
            )

    return profiles, anomalies


# ---------------------------------------------------------------------------
# Output sinks
# ---------------------------------------------------------------------------

class JSONLSink(FixedPartitionedSink):
    """Sink that writes JSON objects as lines to a file."""

    def __init__(self, path: str):
        self.path = path

    def list_parts(self) -> List[str]:
        return ["0"]

    def build_part(
        self,
        step_id: str,
        for_part: str,
        resume_state: Optional[int],
    ) -> StatefulSinkPartition:
        return _JSONLSinkPartition(self.path, resume_state)


class _JSONLSinkPartition(StatefulSinkPartition):
    def __init__(self, path: str, resume_state: Optional[int]):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._file = open(path, "w")
        self._count = resume_state if resume_state is not None else 0

    def write_batch(self, items: List[dict]) -> None:
        for item in items:
            self._file.write(json.dumps(item) + "\n")
            self._count += 1

    def snapshot(self) -> int:
        self._file.flush()
        return self._count

    def close(self) -> None:
        self._file.close()


# ---------------------------------------------------------------------------
# Dataflow construction
# ---------------------------------------------------------------------------

def build_dataflow() -> Dataflow:
    flow = Dataflow("sensor_anomaly_detection")

    # 1. Input: (sensor_id, ts_epoch, value)
    inp = op.input("input", flow, SensorReadingSource(INPUT_PATH))

    # 2. Key by sensor_id
    keyed = op.key_on("key_on", inp, lambda x: x[0])

    # 3. Sliding window fold: accumulate readings per window
    clock = EventClock(
        ts_getter=ts_getter,
        wait_for_system_duration=timedelta(seconds=0),
    )
    windower = SlidingWindower(
        length=WINDOW_LENGTH,
        offset=WINDOW_OFFSET,
        align_to=ALIGN_TO,
    )

    windowed: WindowOut = fold_window(
        "fold_window",
        keyed,
        clock,
        windower,
        builder=builder,
        folder=folder,
        merger=merger,
    )
    # windowed.down: KeyedStream of (sensor_id, (window_id, accum))
    # windowed.meta: KeyedStream of (sensor_id, (window_id, WindowMetadata))

    # 4. Re-key by composite key (sensor_id, window_id) for joining.
    def rekey_down(
        item: Tuple[str, Tuple[int, Accumulator]],
    ) -> List[Tuple[str, Accumulator]]:
        sensor_id, (window_id, accum) = item
        return [(f"{sensor_id}|{window_id}", accum)]

    def rekey_meta(
        item: Tuple[str, Tuple[int, WindowMetadata]],
    ) -> List[Tuple[str, WindowMetadata]]:
        sensor_id, (window_id, meta) = item
        return [(f"{sensor_id}|{window_id}", meta)]

    down_flat = op.flat_map("rekey_down", windowed.down, rekey_down)
    meta_flat = op.flat_map("rekey_meta", windowed.meta, rekey_meta)

    down_keyed = op.key_on("key_down", down_flat, lambda x: x[0])
    meta_keyed = op.key_on("key_meta", meta_flat, lambda x: x[0])

    # 5. Join accum with metadata (both keyed by "sensor_id|window_id").
    joined = op.join(
        "join_meta",
        down_keyed,
        meta_keyed,
        insert_mode="last",
        emit_mode="complete",
    )
    # joined: ("sensor_id|window_id", (("sensor_id|window_id", accum),
    #                                   ("sensor_id|window_id", meta)))

    op.inspect_debug("joined_debug", joined)

    # 6. Compute profiles and anomalies.
    def compute_output(
        key_and_joined: Tuple[
            str,
            Tuple[Tuple[str, Accumulator], Tuple[str, WindowMetadata]],
        ],
    ) -> Tuple[List[dict], List[dict]]:
        composite_key, (down_val, meta_val) = key_and_joined
        sensor_id = composite_key.rsplit("|", 1)[0]
        _down_key, accum = down_val
        _meta_key, meta = meta_val
        return process_window(sensor_id, accum, meta.open_time, meta.close_time)

    results = op.map("compute", joined, compute_output)

    op.inspect_debug("results_debug", results)

    # 7. Split profiles and anomalies, key by sensor_id, output.
    def extract_profiles(
        pa: Tuple[List[dict], List[dict]],
    ) -> List[dict]:
        return pa[0]

    def extract_anomalies(
        pa: Tuple[List[dict], List[dict]],
    ) -> List[dict]:
        return pa[1]

    profiles_flat = op.flat_map("extract_profiles", results, extract_profiles)
    anomalies_flat = op.flat_map("extract_anomalies", results, extract_anomalies)

    profiles_keyed = op.key_on(
        "key_profiles", profiles_flat, lambda x: x["sensor_id"]
    )
    anomalies_keyed = op.key_on(
        "key_anomalies", anomalies_flat, lambda x: x["sensor_id"]
    )

    op.output("output_profiles", profiles_keyed, JSONLSink(PROFILES_PATH))
    op.output("output_anomalies", anomalies_keyed, JSONLSink(ANOMALIES_PATH))

    return flow


# Module-level flow for `python -m bytewax.run`
flow = build_dataflow()
