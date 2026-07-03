import bytewax.operators as op
from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink
from pathlib import Path
from typing import Optional, Tuple

# Create the Bytewax dataflow named 'flow'
flow = Dataflow("sensor_moving_average")

# Read from input.csv in the current directory
input_path = Path("input.csv")
stream = op.input("read_input", flow, FileSource(input_path))

# Parse the lines into Tuple[str, float]
def parse_line(line: str) -> Optional[Tuple[str, float]]:
    line = line.strip()
    if not line:
        return None
    if "," not in line:
        return None
    try:
        sensor_id, temp_str = line.split(",", 1)
        sensor_id = sensor_id.strip()
        temp_str = temp_str.strip()
        # Return the key as string and temperature as float
        return str(sensor_id), float(temp_str)
    except ValueError:
        return None

parsed_stream = op.filter_map("parse_line", stream, parse_line)

# Compute the moving average using stateful map
def update_state(state: Optional[Tuple[float, ...]], temp: float) -> Tuple[Tuple[float, ...], float]:
    if state is None:
        state = ()
    # Return a new state object (tuple) to avoid mutating state in-place
    new_state = state + (temp,)
    if len(new_state) > 3:
        new_state = new_state[-3:]
    moving_avg = sum(new_state) / len(new_state)
    return new_state, moving_avg

moving_avg_stream = op.stateful_map("moving_average", parsed_stream, update_state)

# Format the output for FileSink to write sensor_id,moving_average
def format_output(item: Tuple[str, float]) -> Tuple[str, str]:
    sensor_id, moving_avg = item
    formatted_val = f"{sensor_id},{moving_avg:.2f}"
    return (sensor_id, formatted_val)

formatted_stream = op.map("format_output", moving_avg_stream, format_output)

# Write the output to output.csv in the current directory
output_path = Path("output.csv")
op.output("write_output", formatted_stream, FileSink(output_path))
