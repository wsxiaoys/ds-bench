import json
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.connectors.files import FileSource
from bytewax.connectors.stdio import StdOutSink

# Initialize the dataflow
flow = Dataflow("multi_stage_aggregation")

# Read the finite stream of sensor readings from the JSONL file
# FileSource reads the file line-by-line as strings
lines = op.input("input_file", flow, FileSource("input.jsonl"))

# Parse each JSON line and map it to (sensor_id, val)
def parse_line(line):
    line = line.strip()
    if not line:
        return None
    try:
        data = json.loads(line)
        return (data["sensor_id"], data["val"])
    except (json.JSONDecodeError, KeyError, TypeError):
        return None

sensor_stream = op.filter_map("parse_json", lines, parse_line)

# Stage 1: Local Aggregation
# Group by sensor_id and calculate the sum of val for each sensor.
# Since this is a finite stream, reduce_final will emit the final sum for each key when upstream completes.
local_sums = op.reduce_final("local_sum", sensor_stream, lambda acc, x: acc + x)

# Stage 2: Global Aggregation
# Re-key all items to a single global key "global"
rekeyed_stream = op.map("rekey_global", local_sums, lambda item: ("global", item[1]))

# Calculate the grand total sum of all sensor values
grand_total = op.reduce_final("global_sum", rekeyed_stream, lambda acc, x: acc + x)

# Output the final grand total to standard output
op.output("output_stdout", grand_total, StdOutSink())
