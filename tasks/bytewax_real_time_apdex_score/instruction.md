# Real-Time Apdex Score Calculation with Bytewax

## Background
Calculate the Application Performance Index (Apdex) score in real-time for different services using Bytewax. The Apdex score is a standard method for reporting and comparing the performance of software applications in computing.

## Requirements
- Build a Bytewax dataflow that reads JSON lines from `input.jsonl`.
- Each input line contains: `timestamp` (ISO 8601 string), `service` (string), and `response_time_ms` (integer).
- Calculate the Apdex score per `service` using a **10-second tumbling window** based on the event time (`timestamp`).
- Apdex Threshold (`T`) is **500ms**.
  - **Satisfied**: `response_time_ms <= 500`
  - **Tolerating**: `500 < response_time_ms <= 2000`
  - **Frustrated**: `response_time_ms > 2000`
- Apdex formula: `(Satisfied Count + (Tolerating Count / 2)) / Total Count`.
- Write the results to `output.jsonl`.
- Output JSON format must include `window_start` (ISO 8601 string), `service`, and `apdex_score` (float, rounded to 2 decimal places).

## Implementation Hints
- Use Bytewax's windowing operators (e.g., `fold_window` or `collect_window`) to group and aggregate data by service and time window.
- Configure an event clock to use the `timestamp` field from the input data.
- Use a tumbling windower with a length of 10 seconds.
- Create the Python script as `apdex_flow.py` in the `/home/user/bytewax-apdex` directory, so it can be executed directly as `python apdex_flow.py`.

