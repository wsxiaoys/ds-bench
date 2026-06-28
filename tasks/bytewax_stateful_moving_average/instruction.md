# Bytewax Stateful Moving Average

## Background
Build a stateful stream processing pipeline using Bytewax that computes the moving average of sensor temperature readings.

## Requirements
- Create a Bytewax dataflow named `flow` in `pipeline.py`.
- The dataflow should read sensor readings from `input.csv` in the current directory (lines formatted as `sensor_id,temperature`).
- Compute the moving average of the last 3 temperature readings for each distinct sensor ID.
- If a sensor has fewer than 3 readings so far, compute the average of the available readings.
- The pipeline must use Bytewax's stateful processing capabilities.
- Write the output to `output.csv` in the current directory. The output file must contain exactly one line per input line, formatted as `sensor_id,moving_average`.
- The moving average must be a float rounded to exactly 2 decimal places (e.g., `20.50`).

## Implementation Hints
- Project path: `/home/user/bytewax-task`
- Run the dataflow using `python -m bytewax.run pipeline:flow`.
- Use a custom stateful logic function with `op.stateful_map`.
- Ensure keys are strings.
- Return a new state object (do not mutate the state in-place) to ensure compatibility with recovery snapshots.
- Use standard Python file I/O or Bytewax connectors for reading and writing CSV lines.
