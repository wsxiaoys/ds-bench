"""Bytewax stateful moving average pipeline."""

from collections import deque
from pathlib import Path
from typing import Dict, Optional, Tuple

from bytewax.dataflow import Dataflow
from bytewax import operators as op
from bytewax.connectors.files import FileSource, FileSink

# Ensure output file exists before running (FileSink requires this).
OUTPUT_PATH = Path("output.csv")
OUTPUT_PATH.touch(exist_ok=True)

flow = Dataflow("moving_average")

# Read sensor lines from input.csv.
inp = op.input("inp", flow, FileSource("input.csv"))


def parse_line(line: str) -> Tuple[str, float]:
    """Parse a `sensor_id,temperature` line into a tuple."""
    sensor_id, temp_str = line.strip().split(",", 1)
    return (sensor_id, float(temp_str))


# Parse each line into a (sensor_id, temperature) tuple.
parsed = op.map("parse", inp, parse_line)

# Use a single global key so all processing happens in one worker,
# preserving input order.
keyed = op.key_on("key_on_global", parsed, lambda _x: "global")


def moving_avg(
    state: Optional[Dict[str, deque]], item: Tuple[str, float]
) -> Tuple[Dict[str, deque], Tuple[str, float]]:
    """Stateful step that maintains the last 3 temperatures per sensor.

    Uses a single global key with a dict-of-deques state so that
    per-sensor state is preserved across events while input order
    is maintained.

    Returns a new state object (do not mutate in-place) for snapshot
    compatibility.
    """
    sensor_id, temp = item
    if state is None:
        state = {}
    else:
        # Create new state dict and new deques to avoid in-place mutation.
        state = {sid: deque(dq, maxlen=3) for sid, dq in state.items()}
    if sensor_id not in state:
        state[sensor_id] = deque(maxlen=3)
    state[sensor_id].append(temp)
    avg = sum(state[sensor_id]) / len(state[sensor_id])
    return (state, (sensor_id, round(avg, 2)))


# Maintain per-key state and compute moving average.
stateful = op.stateful_map("moving_avg", keyed, moving_avg)


def format_output(value: Tuple[str, float]) -> str:
    """Format output as `sensor_id,moving_average` with 2 decimal places."""
    sensor_id, avg = value
    return f"{sensor_id},{avg:.2f}"


# Format the value as a CSV line. Keep the key so the sink can route.
formatted = op.map_value("format", stateful, format_output)

# Output to file.
op.output("output", formatted, FileSink("output.csv"))
