# Sessionization of User Events with Bytewax

## Background
Sessionization is a common stream processing task where user events are grouped into sessions based on inactivity. Bytewax provides windowing operators to handle this dynamically.

## Requirements
Create a Bytewax dataflow in `run.py` (located in `/home/user/bytewax-sessionization`) that reads user events from a JSON lines file, groups them into session windows based on event time, and writes the summarized sessions to an output JSON lines file. You should be able to run the script using `python run.py`.

- Read events from `user_events.jsonl` in the same directory. Each line in `user_events.jsonl` contains a JSON object with:
  - `user_id` (string)
  - `event_type` (string)
  - `timestamp` (ISO 8601 string)
- Group events by `user_id`.
- Use a session window with a 30-minute inactivity gap.
- Use event time for the clock.
- For each session, calculate the total number of events, the start time (timestamp of the first event in the session), and the end time (timestamp of the last event in the session).
- Write the results to `sessions.jsonl` in the same directory. Each line must contain exactly one JSON object per session with the following format:
  ```json
  {
    "user_id": "<user_id>",
    "session_start": "<iso_8601_string>",
    "session_end": "<iso_8601_string>",
    "event_count": <integer>
  }
  ```

## Implementation Hints
- Parse the input JSON lines to extract the `user_id` as the key and the event payload as the value.
- Use Bytewax's `EventClock` and `SessionWindower`.
- Use a windowing operator like `collect_window` to gather events in each session, then map the result to calculate the required metrics.
- Ensure timestamps are parsed into `datetime` objects for the clock and formatted back to ISO 8601 strings for the output.

