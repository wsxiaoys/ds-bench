import os
import sys
import uuid
from pathlib import Path
import bytewax.operators as op
from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink

# Read configuration from environment variables
input_file = os.environ.get("INPUT_FILE")
output_file = os.environ.get("OUTPUT_FILE")

if not input_file or not output_file:
    print("Error: INPUT_FILE and OUTPUT_FILE environment variables must be set.", file=sys.stderr)
    sys.exit(1)

flow = Dataflow("bytewax_recovery_pipeline")

# We want the input and output to always start from the beginning of the file on each run.
# To achieve this, we use a dynamic step ID for the input and output operators.
# This prevents Bytewax from resuming the input/output progress from a previous run,
# while still allowing stateful operators (with fixed step IDs) to recover their state.
run_id = os.environ.get("RUN_ID") or str(uuid.uuid4())
input_step_id = f"input_{run_id}"
output_step_id = f"output_{run_id}"

# 1. Input: Read line-by-line using FileSource
stream = op.input(input_step_id, flow, FileSource(Path(input_file)))

# 2. Parse CSV: Convert each line to (key, value)
def parse_csv_line(line):
    line = line.strip()
    if not line:
        return None
    parts = line.split(",")
    if len(parts) != 2:
        return None
    key, val_str = parts[0].strip(), parts[1].strip()
    try:
        val = int(val_str)
        return (key, val)
    except ValueError:
        return None

# Filter out None values
parsed_stream = op.filter_map("parse_csv", stream, parse_csv_line)

# 3. Stateful Map: Maintain running maximum for each key
def update_max(running_max, value):
    if running_max is None:
        running_max = value
    else:
        running_max = max(running_max, value)
    return (running_max, running_max)

# Note: The stateful operator MUST have a fixed step ID to recover its state across runs!
stateful_stream = op.stateful_map("running_max_step", parsed_stream, update_max)

# 4. Format Output: Convert (key, running_max) to (key, "key,running_max") for FileSink
def format_output(item):
    key, running_max = item
    return (key, f"{key},{running_max}")

formatted_stream = op.map("format_output", stateful_stream, format_output)

# 5. Output: Write to output file using FileSink
op.output(output_step_id, formatted_stream, FileSink(Path(output_file)))
