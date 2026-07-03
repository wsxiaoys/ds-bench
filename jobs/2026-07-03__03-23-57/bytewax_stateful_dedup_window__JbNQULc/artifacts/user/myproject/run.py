import json
from datetime import datetime, timedelta
from typing import Dict, Iterable, Optional, Tuple

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators import StatefulLogic
from bytewax.testing import run_main


class DeduplicateLogic(StatefulLogic[dict, dict, dict]):
    def __init__(self, resume_state: Optional[dict]):
        self.state: Dict[str, datetime] = {}
        if resume_state is not None:
            for event_id, ts_val in resume_state.items():
                if isinstance(ts_val, str):
                    self.state[event_id] = datetime.fromisoformat(ts_val)
                else:
                    self.state[event_id] = ts_val

    def on_item(self, value: dict) -> Tuple[Iterable[dict], bool]:
        event_id = value["event_id"]
        curr_ts = datetime.fromisoformat(value["timestamp"])

        # 1. Dynamic cleanup: any event_id older than 10 seconds from the current event's timestamp
        # should be removed from the state.
        # Older than 10 seconds: curr_ts - last_emitted_ts > 10 seconds.
        to_delete = []
        for eid, last_emitted_ts in self.state.items():
            if curr_ts - last_emitted_ts > timedelta(seconds=10):
                to_delete.append(eid)
        
        for eid in to_delete:
            del self.state[eid]

        # 2. Deduplication check
        # If the event_id is still in state, it means it was emitted within the last 10 seconds.
        # So we drop it.
        if event_id in self.state:
            return ([], StatefulLogic.RETAIN)
        else:
            # If not in state, it's either new or was cleaned up (strictly > 10s ago).
            # We emit it and update/insert the timestamp in state.
            self.state[event_id] = curr_ts
            return ([value], StatefulLogic.RETAIN)

    def snapshot(self) -> dict:
        return self.state.copy()


def build_deduplicate_logic(resume_state: Optional[dict]) -> DeduplicateLogic:
    return DeduplicateLogic(resume_state)


def create_dataflow() -> Dataflow:
    flow = Dataflow("deduplication_flow")

    # 1. Read lines from input.jsonl
    raw_stream = op.input("input_step", flow, FileSource("input.jsonl"))

    # 2. Parse JSON lines
    parsed_stream = op.map("parse_json", raw_stream, json.loads)

    # 3. Key stream by user_id
    keyed_stream = op.key_on("key_by_user", parsed_stream, lambda x: x["user_id"])

    # 4. Stateful deduplication
    dedup_stream = op.stateful("deduplicate", keyed_stream, build_deduplicate_logic)

    # 5. Format to (key, JSON string)
    formatted_stream = op.map("format_json", dedup_stream, lambda x: (x[0], json.dumps(x[1])))

    # 6. Write to output.jsonl
    op.output("output_step", formatted_stream, FileSink("output.jsonl"))

    return flow


if __name__ == "__main__":
    flow = create_dataflow()
    run_main(flow)
