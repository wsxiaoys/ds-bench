"""
Bytewax dataflow: Per-window pairwise Pearson correlation matrix.

Reads sensor readings from a JSONL file, groups them into 60-second
tumbling event-time windows, and computes pairwise Pearson correlation
coefficients between sensors within each window.
"""

import json
import math
from datetime import datetime, timedelta, timezone
from itertools import combinations

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.operators.windowing import (
    EventClock,
    TumblingWindower,
    WindowMetadata,
    fold_window,
)
from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from bytewax.outputs import DynamicSink, StatelessSinkPartition

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALIGN_TO = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
WINDOW_LENGTH = timedelta(seconds=60)
MIN_OVERLAP = 3
INPUT_PATH = "/home/user/project/data/readings.jsonl"
OUTPUT_PATH = "/home/user/project/output/correlations.jsonl"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_reading(line: str) -> tuple[str, datetime, float]:
    """Parse a JSONL line into (sensor, ts, value)."""
    obj = json.loads(line)
    ts = datetime.strptime(obj["ts"], "%Y-%m-%dT%H:%M:%SZ").replace(
        tzinfo=timezone.utc
    )
    return (obj["sensor"], ts, obj["value"])


def window_id_to_open(window_id: int) -> datetime:
    """Convert a window ID to its open time."""
    return ALIGN_TO + window_id * WINDOW_LENGTH


def window_id_to_close(window_id: int) -> datetime:
    """Convert a window ID to its close time."""
    return ALIGN_TO + (window_id + 1) * WINDOW_LENGTH


def fmt_ts(dt: datetime) -> str:
    """Format a datetime as '%Y-%m-%dT%H:%M:%SZ' (UTC)."""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def pearson_r(
    xs: list[float], ys: list[float]
) -> float | None:
    """
    Compute the Pearson correlation coefficient for paired samples.

    Returns None when the denominator is zero (constant sensor).
    """
    n = len(xs)
    if n < MIN_OVERLAP:
        return None

    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    dx = [x - mean_x for x in xs]
    dy = [y - mean_y for y in ys]

    cov = sum(dxi * dyi for dxi, dyi in zip(dx, dy))
    var_x = sum(dxi * dxi for dxi in dx)
    var_y = sum(dyi * dyi for dyi in dy)

    denom = math.sqrt(var_x * var_y)
    if denom == 0.0:
        return None

    return cov / denom


def compute_correlations(
    sensors: dict[str, dict[datetime, float]],
) -> list[dict]:
    """
    Compute pairwise Pearson correlations for all sensor pairs.

    Args:
        sensors: {sensor_name: {timestamp: value}}

    Returns:
        List of correlation dicts sorted by pair.
    """
    results = []
    sensor_names = sorted(sensors.keys())

    for s_a, s_b in combinations(sensor_names, 2):
        data_a = sensors[s_a]
        data_b = sensors[s_b]

        # Find overlapping timestamps
        common_ts = sorted(set(data_a.keys()) & set(data_b.keys()))

        n = len(common_ts)
        if n < MIN_OVERLAP:
            continue

        xs = [data_a[t] for t in common_ts]
        ys = [data_b[t] for t in common_ts]

        r = pearson_r(xs, ys)

        if r is not None:
            r = round(r, 6)

        results.append({
            "pair": [s_a, s_b],
            "n": n,
            "r": r,
        })

    return results


# ---------------------------------------------------------------------------
# Source
# ---------------------------------------------------------------------------


class _FilePartition(StatefulSourcePartition):
    """Reads lines from a file, one batch at a time."""

    def __init__(self, path: str):
        self._file = open(path, "r")
        self._done = False

    def next_batch(self):
        if self._done:
            raise StopIteration
        lines = self._file.readlines()
        if not lines:
            self._done = True
            self._file.close()
            raise StopIteration
        return [line.rstrip("\n") for line in lines]

    def snapshot(self):
        return None

    def close(self):
        if not self._done:
            self._file.close()


class _FileSource(FixedPartitionedSource):
    """A source that reads lines from a single file."""

    def __init__(self, path: str):
        self._path = path

    def list_parts(self):
        return ["0"]

    def build_part(self, _step_id, _for_part, _resume_state):
        return _FilePartition(self._path)


# ---------------------------------------------------------------------------
# Sink
# ---------------------------------------------------------------------------


class JSONLSinkPartition(StatelessSinkPartition):
    """Writes items as JSONL lines to a file."""

    def __init__(self, path: str):
        self._path = path
        self._file = None

    def write_batch(self, items):
        if self._file is None:
            self._file = open(self._path, "w")
        for item in items:
            self._file.write(json.dumps(item) + "\n")
            self._file.flush()

    def close(self):
        if self._file is not None:
            self._file.close()


class JSONLSink(DynamicSink):
    """Dynamic sink that creates a JSONL partition."""

    def __init__(self, path: str):
        self._path = path

    def build(self, _step_id, _worker_index, _worker_count):
        return JSONLSinkPartition(self._path)


# ---------------------------------------------------------------------------
# Dataflow
# ---------------------------------------------------------------------------


flow = Dataflow("correlation_matrix")

# 1. Read input file
lines = op.input("input", flow, _FileSource(INPUT_PATH))

# 2. Parse JSONL → (sensor, ts, value)
readings = op.map("parse", lines, parse_reading)

# 3. Key by sensor for per-sensor windowing
keyed = op.key_on("key_by_sensor", readings, lambda r: r[0])

# 4. Event-time windowing: accumulate {ts: value} per sensor per window
clock = EventClock(
    ts_getter=lambda r: r[1],
    wait_for_system_duration=timedelta(seconds=0),
)
windower = TumblingWindower(length=WINDOW_LENGTH, align_to=ALIGN_TO)

wo = fold_window(
    "window_by_sensor",
    keyed,
    clock,
    windower,
    builder=lambda: {},
    folder=lambda acc, r: {**acc, r[1]: r[2]},
    merger=lambda a, b: {**a, **b},
)

# 5. Map wo.down to (window_id_str, (sensor, {ts: value}))
def _map_to_window_key(item):
    sensor, (window_id, data) = item
    return (str(window_id), (sensor, data))


window_keyed = op.map("map_to_window_key", wo.down, _map_to_window_key)

# 6. Collect all sensors for each window
collected = op.collect(
    "collect_by_window",
    window_keyed,
    timeout=timedelta(seconds=5),
    max_size=1000,
)

# 7. Compute correlations per window
def _build_window_output(item):
    window_id_str, sensor_list = item
    window_id = int(window_id_str)

    sensors = {}
    for sensor_name, data in sensor_list:
        sensors[sensor_name] = data

    correlations = compute_correlations(sensors)

    if not correlations:
        return None  # filtered out below

    return {
        "window_start": fmt_ts(window_id_to_open(window_id)),
        "window_end": fmt_ts(window_id_to_close(window_id)),
        "correlations": correlations,
    }


window_outputs = op.filter_map(
    "compute_correlations", collected, _build_window_output
)

# 8. Write to output file
op.output("sink", window_outputs, JSONLSink(OUTPUT_PATH))
