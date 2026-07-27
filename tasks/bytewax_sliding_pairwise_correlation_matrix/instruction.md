# Bytewax: Per-Window Pairwise Pearson Correlation Matrix

## Background
You are building a stateful stream-processing pipeline with **Bytewax** (a Python-native stream processor) that ingests aligned multi-sensor time-series readings, groups them into fixed event-time windows, and computes the pairwise **Pearson correlation** matrix between sensors within each window. The per-window correlations are written to a local JSONL sink.

## Requirements
- Read sensor readings from a local JSONL input file.
- Group readings into fixed-length, non-overlapping **event-time** windows.
- Within each window, for every pair of sensors, compute the Pearson correlation coefficient using only the timestamps at which BOTH sensors of the pair reported a value in that window (sample alignment by timestamp).
- Apply a minimum-overlap threshold, deterministic pair ordering, and stable rounding as specified below.
- Emit the per-window correlation results to a local JSONL sink.

## Implementation Hints
- Project path: `/home/user/project`.
- Use `bytewax==0.21.1`. The dataflow must be defined at module path `dataflow` (i.e. `/home/user/project/dataflow.py`) as a top-level attribute named `flow`, and must run to completion (exit code 0) with:
  `python -m bytewax.run dataflow:flow` executed with the working directory set to the project path.
- Input file: `/home/user/project/data/readings.jsonl`. Each line is a JSON object with exactly the keys `sensor` (string), `ts` (ISO-8601 UTC timestamp string ending in `Z`, e.g. `2024-01-01T00:00:00Z`), and `value` (number). Readings appear in nondecreasing `ts` order, and each `(sensor, ts)` combination occurs at most once.
- Windowing: fixed-length **tumbling** event-time windows of exactly 60 seconds, aligned so that a window boundary falls on the epoch `2024-01-01T00:00:00Z`. Window open times are inclusive and close times are exclusive; a reading with timestamp `t` belongs to the single window `[align + k*60s, align + (k+1)*60s)` that contains it.
- Overlap definition: within one window, two sensors overlap at a timestamp only when BOTH reported a value at that exact timestamp. A pair's correlation is computed over its overlapping timestamps only, pairing each sensor's value at each shared timestamp.
- Pearson correlation over the overlapping paired samples `(x_i, y_i)` with means `x_bar`, `y_bar`:
  `r = sum_i (x_i - x_bar)*(y_i - y_bar) / sqrt( sum_i (x_i - x_bar)^2 * sum_i (y_i - y_bar)^2 )`
- Minimum-overlap threshold: include a sensor pair only when its number of overlapping timestamps `n` satisfies `n >= 3`. Pairs with `n < 3` must be omitted entirely.
- Undefined correlation: when `n >= 3` but the denominator above is 0 (i.e. at least one of the two sensors is constant across the overlap), represent `r` as JSON `null`.
- Rounding: round every finite `r` to 6 decimal places.
- Output file: `/home/user/project/output/correlations.jsonl`. Write exactly one JSON object per window that has at least one qualifying pair (`n >= 3`); windows with no qualifying pair must not produce a line. Output lines must be ordered by window start time ascending.
- Each output object must contain exactly these keys:
  - `window_start`: the window open time formatted as `%Y-%m-%dT%H:%M:%SZ` (UTC).
  - `window_end`: the window close time (open + 60s) formatted as `%Y-%m-%dT%H:%M:%SZ` (UTC).
  - `correlations`: a JSON array of objects, each with exactly the keys `pair` (a 2-element array `[sensor_a, sensor_b]` with `sensor_a < sensor_b` by lexicographic string comparison), `n` (integer count of overlapping timestamps), and `r` (the rounded correlation number, or `null`). The array must be ordered ascending by `pair`, i.e. by `sensor_a` then `sensor_b`.

