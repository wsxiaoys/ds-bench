"""Sliding-window z-score anomaly detection dataflow (Bytewax 0.21.1).

Reads per-sensor readings from a JSONL file, computes per-sensor
per-window statistical profiles over 60s sliding windows (30s slide,
aligned to the Unix epoch), flags readings whose absolute z-score
(relative to the window's own mean/std) exceeds a configurable
threshold, and writes both the window profiles and the flagged
anomalies to local JSONL files.

Designed to run with Bytewax's SQLite recovery enabled; all state
kept by this pipeline (plain lists of (int, float) tuples) is fully
picklable.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators.windowing import EventClock, SlidingWindower, fold_window

PROJECT_DIR = Path(__file__).resolve().parent
INPUT_PATH = PROJECT_DIR / "data" / "sensor_readings.jsonl"
OUTPUT_DIR = PROJECT_DIR / "output"
PROFILES_PATH = OUTPUT_DIR / "profiles.jsonl"
ANOMALIES_PATH = OUTPUT_DIR / "anomalies.jsonl"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

WINDOW_LENGTH = timedelta(seconds=60)
WINDOW_SLIDE = timedelta(seconds=30)
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
SLIDE_SECONDS = int(WINDOW_SLIDE.total_seconds())
LENGTH_SECONDS = int(WINDOW_LENGTH.total_seconds())

ZSCORE_THRESHOLD = float(os.environ.get("ZSCORE_THRESHOLD", "3.0"))

Reading = Tuple[int, float]  # (epoch_seconds, value)


def parse_line(line: str) -> Dict[str, Any]:
    """Parse a raw JSONL line into a record with an epoch-second ts."""
    obj = json.loads(line)
    ts = datetime.fromisoformat(obj["ts"])
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    epoch_seconds = int((ts - EPOCH).total_seconds())
    return {
        "sensor_id": obj["sensor_id"],
        "ts": ts,
        "epoch_seconds": epoch_seconds,
        "value": float(obj["value"]),
    }


def key_by_sensor(record: Dict[str, Any]) -> str:
    return record["sensor_id"]


def get_ts(record: Dict[str, Any]) -> datetime:
    return record["ts"]


def build_acc() -> List[Reading]:
    return []


def fold_acc(acc: List[Reading], record: Dict[str, Any]) -> List[Reading]:
    acc.append((record["epoch_seconds"], record["value"]))
    return acc


def merge_acc(a: List[Reading], b: List[Reading]) -> List[Reading]:
    # Sliding windows never merge, but a merger is required by the API.
    return a + b


def _stats(values: List[float]) -> Tuple[int, float, float, float]:
    count = len(values)
    mean = sum(values) / count
    variance = sum((v - mean) ** 2 for v in values) / count
    std = variance ** 0.5
    return count, mean, variance, std


def compute_profile(item: Tuple[str, Tuple[int, List[Reading]]]) -> Dict[str, Any]:
    sensor_id, (window_id, readings) = item
    window_start = window_id * SLIDE_SECONDS
    window_end = window_start + LENGTH_SECONDS
    values = [v for _, v in readings]
    count, mean, variance, std = _stats(values)
    return {
        "sensor_id": sensor_id,
        "window_start": window_start,
        "window_end": window_end,
        "count": count,
        "mean": round(mean, 6),
        "variance": round(variance, 6),
        "std": round(std, 6),
    }


def compute_anomalies(
    item: Tuple[str, Tuple[int, List[Reading]]]
) -> List[Dict[str, Any]]:
    sensor_id, (window_id, readings) = item
    window_start = window_id * SLIDE_SECONDS
    values = [v for _, v in readings]
    _count, mean, _variance, std = _stats(values)

    anomalies = []
    for ts, value in readings:
        zscore = 0.0 if std == 0 else (value - mean) / std
        if abs(zscore) > ZSCORE_THRESHOLD:
            anomalies.append(
                {
                    "sensor_id": sensor_id,
                    "ts": ts,
                    "value": value,
                    "window_start": window_start,
                    "zscore": round(zscore, 6),
                }
            )
    return anomalies


def to_json_line(obj: Dict[str, Any]) -> str:
    return json.dumps(obj)


flow = Dataflow("sensor_anomaly_detection")

lines = op.input("read_lines", flow, FileSource(str(INPUT_PATH)))
records = op.map("parse_line", lines, parse_line)
keyed = op.key_on("key_by_sensor", records, key_by_sensor)

clock = EventClock(ts_getter=get_ts, wait_for_system_duration=timedelta(seconds=0))
windower = SlidingWindower(length=WINDOW_LENGTH, offset=WINDOW_SLIDE, align_to=EPOCH)

window_out = fold_window(
    "sliding_window",
    keyed,
    clock,
    windower,
    builder=build_acc,
    folder=fold_acc,
    merger=merge_acc,
)

profiles = op.map("compute_profile", window_out.down, compute_profile)
keyed_profiles = op.key_on("key_profiles", profiles, lambda p: p["sensor_id"])
profile_lines = op.map_value("profile_to_json", keyed_profiles, to_json_line)
op.output("write_profiles", profile_lines, FileSink(str(PROFILES_PATH)))

anomalies = op.flat_map("compute_anomalies", window_out.down, compute_anomalies)
keyed_anomalies = op.key_on("key_anomalies", anomalies, lambda a: a["sensor_id"])
anomaly_lines = op.map_value("anomaly_to_json", keyed_anomalies, to_json_line)
op.output("write_anomalies", anomaly_lines, FileSink(str(ANOMALIES_PATH)))
