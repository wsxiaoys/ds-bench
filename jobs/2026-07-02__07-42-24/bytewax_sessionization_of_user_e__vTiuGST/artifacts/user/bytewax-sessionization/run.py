import json
from datetime import datetime, timedelta
from pathlib import Path
import bytewax.operators as op
import bytewax.operators.windowing as win
from bytewax.dataflow import Dataflow
from bytewax.connectors.files import FileSource, FileSink
from bytewax.testing import run_main

def main():
    # Define paths relative to this script
    script_dir = Path(__file__).parent.resolve()
    input_path = script_dir / "user_events.jsonl"
    output_path = script_dir / "sessions.jsonl"

    # Create the dataflow
    flow = Dataflow("sessionization")

    # Read lines from user_events.jsonl
    stream = op.input("inp", flow, FileSource(str(input_path)))

    # Parse JSON and key by user_id
    def parse_and_key(line):
        event = json.loads(line)
        return event["user_id"], event

    keyed = op.map("parse_and_key", stream, parse_and_key)

    # Configure EventClock and SessionWindower
    def extract_timestamp(event):
        return datetime.fromisoformat(event["timestamp"])

    clock = win.EventClock(ts_getter=extract_timestamp, wait_for_system_duration=timedelta(seconds=0))
    windower = win.SessionWindower(gap=timedelta(minutes=30))

    # Collect events into session windows
    windowed = win.collect_window("collect_sessions", keyed, clock, windower)

    # Summarize sessions
    def summarize_session(item):
        user_id, (window_id, events) = item
        timestamps = [datetime.fromisoformat(e["timestamp"]) for e in events]
        session_start = min(timestamps)
        session_end = max(timestamps)
        event_count = len(events)
        
        # Format back to ISO 8601 with 'Z'
        start_str = session_start.isoformat().replace("+00:00", "Z")
        end_str = session_end.isoformat().replace("+00:00", "Z")
        
        result = {
            "user_id": user_id,
            "session_start": start_str,
            "session_end": end_str,
            "event_count": event_count
        }
        # FileSink expects a (key, value) tuple where the value is a string (representing the line)
        return user_id, json.dumps(result)

    summarized = op.map("summarize_session", windowed.down, summarize_session)

    # Output to sessions.jsonl
    op.output("out", summarized, FileSink(str(output_path)))

    # Run the dataflow
    run_main(flow)

if __name__ == "__main__":
    main()
