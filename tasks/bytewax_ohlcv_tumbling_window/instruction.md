# Tumbling Window OHLCV Aggregation

## Background
Financial market data often arrives as a continuous stream of individual trades. To analyze this data, it's common to aggregate trades into Open-High-Low-Close-Volume (OHLCV) bars over fixed time intervals using a stream processing framework like Bytewax.

## Requirements
- Create a Bytewax dataflow in `run.py` that reads a CSV file containing trade data.
- The script must accept `--input` and `--output` command-line arguments to specify the paths of the input CSV file and the output JSONL file, respectively (e.g., `python run.py --input input.csv --output output.jsonl`).
- The input CSV file contains a header `timestamp,symbol,price,volume` with timestamps in ISO 8601 format.
- Group the trades by ticker symbol.
- Apply a 1-minute tumbling window using the trade timestamps (event time).
- For each window and symbol, calculate the OHLCV metrics: Open (first trade price), High (maximum trade price), Low (minimum trade price), Close (last trade price), and Volume (sum of trade volumes).
- Write the aggregated 1-minute tumbling window OHLCV bars (aligned to the minute) to a JSON Lines (JSONL) file at the path specified by `--output`.
- Each line in the output JSONL file must be a JSON object containing the following exact keys:
  - `window_start`: The window start time in ISO 8601 format (e.g., `"2023-10-01T10:00:00Z"`).
  - `symbol`: The ticker symbol.
  - `open`: The first trade price in the window.
  - `high`: The maximum trade price in the window.
  - `low`: The minimum trade price in the window.
  - `close`: The last trade price in the window.
  - `volume`: The sum of trade volumes in the window.

## Implementation Hints
- Use Bytewax's `EventClock` and `TumblingWindower` to define the time-based windowing logic.
- The input stream should be keyed by the ticker symbol before windowing.
- Consider using `fold_window` to accumulate the OHLCV state as each trade arrives in the window.

