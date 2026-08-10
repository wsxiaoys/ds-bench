import os
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple, Set

from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.inputs import StatefulSourcePartition, FixedPartitionedSource
from bytewax.connectors.files import FileSink

# Create output directory
os.makedirs("/home/user/project/output", exist_ok=True)

# Read threshold from environment variable, default to 3.0
threshold = float(os.environ.get("ZSCORE_THRESHOLD", "3.0"))

class SensorSourcePartition(StatefulSourcePartition[dict, Tuple[int, bool, Set[str]]]):
    def __init__(self, path: Path, resume_state: Optional[Tuple[int, bool, Set[str]]]):
        self._path = path
        self._f = open(path, "rt")
        if resume_state is not None:
            offset, sentinels_sent, sensors_seen = resume_state
            self._f.seek(offset)
            self._sentinels_sent = sentinels_sent
            self._sensors_seen = set(sensors_seen)
        else:
            self._sentinels_sent = False
            self._sensors_seen = set()

    def next_batch(self) -> List[dict]:
        batch_items = []
        for _ in range(100):
            line = self._f.readline()
            if not line:
                # EOF of file
                if not self._sentinels_sent:
                    self._sentinels_sent = True
                    for s_id in sorted(list(self._sensors_seen)):
                        batch_items.append({
                            "sensor_id": s_id,
                            "ts": 2000000000,  # Far future timestamp to flush all windows
                            "value": 0.0,
                            "is_sentinel": True
                        })
                    break
                else:
                    raise StopIteration()
            else:
                data = json.loads(line)
                sensor_id = data["sensor_id"]
                self._sensors_seen.add(sensor_id)
                ts_dt = datetime.fromisoformat(data["ts"])
                ts_epoch = int(ts_dt.timestamp())
                batch_items.append({
                    "sensor_id": sensor_id,
                    "ts": ts_epoch,
                    "value": float(data["value"]),
                    "is_sentinel": False
                })

        if not batch_items:
            raise StopIteration()

        return batch_items

    def snapshot(self) -> Tuple[int, bool, Set[str]]:
        return (self._f.tell(), self._sentinels_sent, self._sensors_seen.copy())

    def close(self) -> None:
        self._f.close()

class SensorJSONLSource(FixedPartitionedSource[dict, Tuple[int, bool, Set[str]]]):
    def __init__(self, path: Path):
        self._path = Path(path)

    def list_parts(self) -> List[str]:
        return ["single-partition"]

    def build_part(self, step_id: str, for_part: str, resume_state: Optional[Tuple[int, bool, Set[str]]]) -> SensorSourcePartition:
        return SensorSourcePartition(self._path, resume_state)

class WindowState:
    def __init__(self):
        # Maps window_start (int) to list of (ts, value)
        self.active_windows = {}

def process_reading(state: Optional[WindowState], reading: dict) -> Tuple[Optional[WindowState], List[Tuple[str, dict]]]:
    if state is None:
        state = WindowState()

    sensor_id = reading["sensor_id"]
    ts = reading["ts"]
    value = reading["value"]
    is_sentinel = reading["is_sentinel"]

    emitted_items = []

    # Close completed windows
    completed_starts = [w_start for w_start in state.active_windows if w_start + 60 <= ts]
    completed_starts.sort()

    for w_start in completed_starts:
        window_readings = state.active_windows.pop(w_start)
        w_end = w_start + 60

        count = len(window_readings)
        values = [v for _, v in window_readings]
        mean = sum(values) / count
        variance = sum((v - mean) ** 2 for v in values) / count
        std = variance ** 0.5

        profile = {
            "sensor_id": sensor_id,
            "window_start": w_start,
            "window_end": w_end,
            "count": count,
            "mean": round(mean, 6),
            "variance": round(variance, 6),
            "std": round(std, 6)
        }
        emitted_items.append(("profile", profile))

        for r_ts, r_val in window_readings:
            if std == 0.0:
                zscore = 0.0
            else:
                zscore = (r_val - mean) / std

            if abs(zscore) > threshold:
                anomaly = {
                    "sensor_id": sensor_id,
                    "ts": r_ts,
                    "value": r_val,
                    "window_start": w_start,
                    "zscore": round(zscore, 6)
                }
                emitted_items.append(("anomaly", anomaly))

    # Add non-sentinel reading to windows
    if not is_sentinel:
        w_start1 = (ts // 30) * 30
        w_start2 = ((ts // 30) - 1) * 30

        for w_start in (w_start1, w_start2):
            if w_start not in state.active_windows:
                state.active_windows[w_start] = []
            state.active_windows[w_start].append((ts, value))

    if is_sentinel and not state.active_windows:
        return (None, emitted_items)

    return (state, emitted_items)

# Build the dataflow
flow = Dataflow("anomaly-detection")

# Input
readings = op.input("input", flow, SensorJSONLSource(Path("/home/user/project/data/sensor_readings.jsonl")))

# Key by sensor_id
keyed_readings = op.key_on("key_by_sensor", readings, lambda x: x["sensor_id"])

# Stateful map to compute windows, profiles, and anomalies
stateful_stream = op.stateful_flat_map("process_windows", keyed_readings, process_reading)

# Filter profiles
def get_profile(item):
    tag, data = item
    if tag == "profile":
        return data
    return None

profiles_stream = op.filter_map_value("filter_profiles", stateful_stream, get_profile)
formatted_profiles = op.map_value("format_profiles", profiles_stream, lambda x: json.dumps(x))

# Filter anomalies
def get_anomaly(item):
    tag, data = item
    if tag == "anomaly":
        return data
    return None

anomalies_stream = op.filter_map_value("filter_anomalies", stateful_stream, get_anomaly)
formatted_anomalies = op.map_value("format_anomalies", anomalies_stream, lambda x: json.dumps(x))

# Output Sinks
op.output("profiles_out", formatted_profiles, FileSink(Path("/home/user/project/output/profiles.jsonl")))
op.output("anomalies_out", formatted_anomalies, FileSink(Path("/home/user/project/output/anomalies.jsonl")))
