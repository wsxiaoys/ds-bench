import json
import math
import pathlib
import itertools
from datetime import datetime, timedelta, timezone
import bytewax.operators as op
import bytewax.operators.windowing as win
from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink

# Define the flow
flow = Dataflow("sensor_correlation")

# 1. Input: Read sensor readings from the JSONL file
input_path = "/home/user/project/data/readings.jsonl"
stream = op.input("input", flow, FileSource(input_path))

# 2. Parse the lines
def parse_line(line: str):
    data = json.loads(line)
    ts = datetime.fromisoformat(data["ts"])
    return "global", {
        "sensor": data["sensor"],
        "ts": ts,
        "value": float(data["value"])
    }

parsed_stream = op.map("parse", stream, parse_line)

# 3. Windowing
# Tumbling event-time windows of exactly 60 seconds
clock = win.EventClock(
    ts_getter=lambda x: x["ts"],
    wait_for_system_duration=timedelta(seconds=0)
)
windower = win.TumblingWindower(
    length=timedelta(seconds=60),
    align_to=datetime(2024, 1, 1, 0, 0, tzinfo=timezone.utc)
)

win_out = win.collect_window("collect", parsed_stream, clock, windower)

# 4. Format/Join the windowed data and metadata
# win_out.down is Stream[Tuple[str, Tuple[int, List[dict]]]]
# win_out.meta is Stream[Tuple[str, Tuple[int, WindowMetadata]]]
# Key them by string "global:{window_id}" to join
down_keyed = op.map("down_keyed", win_out.down, lambda x: (f"{x[0]}:{x[1][0]}", x[1][1]))
meta_keyed = op.map("meta_keyed", win_out.meta, lambda x: (f"{x[0]}:{x[1][0]}", x[1][1]))

joined = op.join("join", down_keyed, meta_keyed)

# 5. Compute the Pearson correlation matrix for each window
def compute_correlations(joined_item):
    key, (readings, meta) = joined_item
    
    # Group readings by timestamp
    ts_to_sensors = {}
    for r in readings:
        ts = r["ts"]
        sensor = r["sensor"]
        val = r["value"]
        if ts not in ts_to_sensors:
            ts_to_sensors[ts] = {}
        ts_to_sensors[ts][sensor] = val
        
    # Get all unique sensors in this window, sorted
    all_sensors = sorted(list(set(r["sensor"] for r in readings)))
    
    correlations = []
    
    # Generate all pairs of sensors (sensor_a < sensor_b)
    for sensor_a, sensor_b in itertools.combinations(all_sensors, 2):
        # Find all overlapping timestamps
        paired_values = []
        for ts, sensors in ts_to_sensors.items():
            if sensor_a in sensors and sensor_b in sensors:
                paired_values.append((sensors[sensor_a], sensors[sensor_b]))
                
        n = len(paired_values)
        if n >= 3:
            xs = [p[0] for p in paired_values]
            ys = [p[1] for p in paired_values]
            
            x_bar = sum(xs) / n
            y_bar = sum(ys) / n
            
            num = sum((x - x_bar) * (y - y_bar) for x, y in zip(xs, ys))
            den_x = max(0.0, sum((x - x_bar) ** 2 for x in xs))
            den_y = max(0.0, sum((y - y_bar) ** 2 for y in ys))
            
            den = math.sqrt(den_x * den_y)
            
            if den == 0.0:
                r = None
            else:
                r = num / den
                r = round(r, 6)
                
            correlations.append({
                "pair": [sensor_a, sensor_b],
                "n": n,
                "r": r
            })
            
    # Sort correlations by pair ascending (sensor_a then sensor_b)
    correlations.sort(key=lambda x: x["pair"])
    
    # Format window times
    window_start = meta.open_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    window_end = meta.close_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    return {
        "window_start": window_start,
        "window_end": window_end,
        "correlations": correlations
    }

# Map joined stream to correlation results
correlation_results = op.map("compute", joined, compute_correlations)

# Filter out windows with no qualifying pairs (correlations is empty)
filtered_results = op.filter("filter_empty", correlation_results, lambda x: len(x["correlations"]) > 0)

# 6. Format as JSONL string
def format_jsonl(result):
    return "global", json.dumps(result)

formatted_stream = op.map("format", filtered_results, format_jsonl)

# 7. Output: Write to local JSONL sink
output_path = pathlib.Path("/home/user/project/output/correlations.jsonl")
op.output("output", formatted_stream, FileSink(output_path))
