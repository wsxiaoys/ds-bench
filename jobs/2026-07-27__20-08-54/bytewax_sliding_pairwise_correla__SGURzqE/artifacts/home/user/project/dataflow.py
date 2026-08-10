"""Per-window pairwise Pearson correlation matrix over aligned sensor readings."""

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators.windowing import EventClock, TumblingWindower, collect_window

PROJECT_DIR = Path("/home/user/project")
INPUT_PATH = PROJECT_DIR / "data" / "readings.jsonl"
OUTPUT_PATH = PROJECT_DIR / "output" / "correlations.jsonl"

WINDOW_LENGTH = timedelta(seconds=60)
ALIGN_TO = datetime(2024, 1, 1, tzinfo=timezone.utc)

MIN_OVERLAP = 3
TS_FORMAT = "%Y-%m-%dT%H:%M:%SZ"

# Make sure the output file exists and is empty/truncated before the sink
# opens it (FileSink requires the file to already exist).
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.touch()


def parse_line(line: str) -> dict:
    obj = json.loads(line)
    ts = datetime.fromisoformat(obj["ts"].replace("Z", "+00:00"))
    return {"sensor": obj["sensor"], "ts": ts, "value": float(obj["value"])}


def get_timestamp(record: dict) -> datetime:
    return record["ts"]


def compute_window(item):
    """item is (window_id, list_of_records). Returns (window_start, line) or None."""
    window_id, records = item

    window_start = ALIGN_TO + window_id * WINDOW_LENGTH
    window_end = window_start + WINDOW_LENGTH

    by_sensor = {}
    for r in records:
        by_sensor.setdefault(r["sensor"], {})[r["ts"]] = r["value"]

    sensors = sorted(by_sensor.keys())
    correlations = []
    for i in range(len(sensors)):
        for j in range(i + 1, len(sensors)):
            a, b = sensors[i], sensors[j]
            common_ts = sorted(set(by_sensor[a]) & set(by_sensor[b]))
            n = len(common_ts)
            if n < MIN_OVERLAP:
                continue

            xs = [by_sensor[a][t] for t in common_ts]
            ys = [by_sensor[b][t] for t in common_ts]
            mean_x = sum(xs) / n
            mean_y = sum(ys) / n

            num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
            var_x = sum((x - mean_x) ** 2 for x in xs)
            var_y = sum((y - mean_y) ** 2 for y in ys)
            den = math.sqrt(var_x * var_y)

            if den == 0:
                r_val = None
            else:
                r_val = round(num / den, 6)
                if r_val == 0:
                    # Normalize away any signed-zero artifact from rounding.
                    r_val = 0.0

            correlations.append({"pair": [a, b], "n": n, "r": r_val})

    if not correlations:
        return None

    result = {
        "window_start": window_start.strftime(TS_FORMAT),
        "window_end": window_end.strftime(TS_FORMAT),
        "correlations": correlations,
    }
    return (window_start, json.dumps(result))


def finalize(acc):
    lines = [line for _start, line in sorted(acc, key=lambda t: t[0])]
    return lines


flow = Dataflow("sensor_correlations")

lines_in = op.input("read_lines", flow, FileSource(str(INPUT_PATH)))
records = op.map("parse_line", lines_in, parse_line)
keyed_records = op.key_on("key_on_const", records, lambda _r: "all")

clock = EventClock(
    ts_getter=get_timestamp,
    wait_for_system_duration=timedelta(seconds=0),
)
windower = TumblingWindower(length=WINDOW_LENGTH, align_to=ALIGN_TO)

windowed = collect_window("collect_window", keyed_records, clock, windower)

computed = op.filter_map_value("compute_window", windowed.down, compute_window)

collected = op.fold_final(
    "collect_all_windows",
    computed,
    lambda: [],
    lambda acc, val: acc + [val],
)

sorted_lines = op.map_value("sort_and_format", collected, finalize)
flat_lines = op.flat_map_value("flatten_lines", sorted_lines, lambda lst: lst)

op.output("write_output", flat_lines, FileSink(str(OUTPUT_PATH)))
