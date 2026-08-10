# Sliding-Window Z-Score Anomaly Detection with Recoverable State (Bytewax)

## Background
You are building a real-time sensor-monitoring pipeline with **Bytewax** (`bytewax==0.21.1`), a Python-native stateful stream-processing framework. The pipeline must compute a rolling statistical profile for each sensor over **event time**, flag readings that deviate strongly from their local profile, and remain **fault-tolerant** by running with Bytewax's SQLite recovery enabled (so all pipeline state must be snapshot-able / picklable).

## Requirements
- Ingest per-sensor readings from a local JSONL file.
- Group each sensor's readings into overlapping **event-time sliding windows** and compute a per-window statistical profile (count, mean, variance, standard deviation).
- Compute the z-score of every reading against the profile of each window it belongs to, and flag readings whose absolute z-score exceeds a configurable threshold as anomalies.
- Run the dataflow with Bytewax **SQLite recovery** enabled; any state kept by the pipeline must be fully picklable.
- Write two local JSONL outputs: one with the per-window profiles and one with the flagged anomalies.

## Implementation Hints
- Project path: `/home/user/project`
- Requires `bytewax==0.21.1`. Execute the dataflow with `python -m bytewax.run`.
- Input file: `/home/user/project/data/sensor_readings.jsonl`. Each line is a JSON object with keys `sensor_id` (string), `ts` (ISO-8601 UTC timestamp on whole-second boundaries, e.g. `2024-03-01T12:00:00+00:00`), and `value` (number). Readings are already sorted ascending by `ts`, and each `(sensor_id, ts)` pair is unique.
- Windowing (event time, using each reading's `ts`): sliding windows of **length 60 seconds** advancing every **30 seconds (slide/offset)**, aligned so that window boundaries land exactly on the Unix epoch instant `1970-01-01T00:00:00+00:00`. Window intervals are half-open `[start, start + 60s)` (start inclusive, end exclusive), so an ordinary reading falls into exactly two overlapping windows. Only windows that contain at least one reading are emitted.
- Per-window profile statistics (computed per sensor, per window): `count` = number of readings in the window; `mean` = arithmetic mean of the values; `variance` = **population** variance (sum of squared deviations divided by `count`); `std` = square root of the population variance.
- Anomaly rule: for each reading in each window, its z-score is `(value - mean) / std` using that window's `mean` and population `std`. If `std` is `0`, treat the z-score as `0`. A reading is an anomaly in a window if and only if the **absolute** z-score is **strictly greater** than the threshold. Because windows overlap, the same reading may be flagged in more than one window (once per qualifying window).
- Threshold: read the float threshold from the environment variable `ZSCORE_THRESHOLD`; when it is unset, default to `3.0`.
- Numeric formatting: round `mean`, `variance`, `std`, and `zscore` to 6 decimal places. Express all timestamps in the output as integer Unix epoch **seconds** (UTC).
- Profiles output file: `/home/user/project/output/profiles.jsonl`. One JSON object per line, each with exactly these keys: `sensor_id` (string), `window_start` (int, epoch seconds, inclusive window open time), `window_end` (int, epoch seconds, exclusive window close time), `count` (int), `mean` (number), `variance` (number), `std` (number).
- Anomalies output file: `/home/user/project/output/anomalies.jsonl`. One JSON object per line, each with exactly these keys: `sensor_id` (string), `ts` (int, epoch seconds of the reading), `value` (number, the reading's value), `window_start` (int, epoch seconds of the window the reading was flagged in), `zscore` (number). If no readings are flagged, this file may be empty or absent.
- Recovery: the dataflow must run with Bytewax SQLite recovery enabled, with the recovery partitions stored in the directory `/home/user/project/recovery`.
- Entrypoint: provide an executable script at `/home/user/project/run.sh`. Invoking `bash /home/user/project/run.sh` from a clean state must initialize the recovery partitions, execute the dataflow with recovery enabled, (re)produce both output files, and exit with status code `0`. It must remain correct and idempotent when invoked repeatedly.
- The order of lines within each output file does not matter.

