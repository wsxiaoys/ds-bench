#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Optional, Tuple

import bytewax.operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.testing import run_main


class UserState:
    def __init__(self, state_name="LOGGED_OUT", login_timestamp=None, large_transaction_count=0):
        self.state_name = state_name
        self.login_timestamp = login_timestamp
        self.large_transaction_count = large_transaction_count

    def copy(self):
        return UserState(
            state_name=self.state_name,
            login_timestamp=self.login_timestamp,
            large_transaction_count=self.large_transaction_count
        )


def transition(state: Optional[UserState], event: dict) -> Tuple[Optional[UserState], Optional[dict]]:
    if state is None:
        state = UserState()

    event_type = event.get("event_type")
    timestamp = event.get("timestamp")
    user_id = event.get("user_id")

    if event_type == "login":
        new_state = UserState(
            state_name="LOGGED_IN",
            login_timestamp=timestamp,
            large_transaction_count=0
        )
        return new_state, None

    elif event_type == "logout":
        new_state = UserState(
            state_name="LOGGED_OUT",
            login_timestamp=None,
            large_transaction_count=0
        )
        return new_state, None

    elif event_type == "transaction":
        if state.state_name in ("LOGGED_IN", "SUSPICIOUS"):
            # Check if transaction occurs more than 300 seconds after the login
            elapsed = timestamp - state.login_timestamp
            if elapsed > 300:
                # Reset to LOGGED_OUT, current transaction is ignored
                new_state = UserState(
                    state_name="LOGGED_OUT",
                    login_timestamp=None,
                    large_transaction_count=0
                )
                return new_state, None
            else:
                amount = event.get("amount", 0)
                if amount >= 1000:
                    new_count = state.large_transaction_count + 1
                    if new_count == 3:
                        new_state = UserState(
                            state_name="LOGGED_OUT",
                            login_timestamp=None,
                            large_transaction_count=0
                        )
                        alert = {"user_id": user_id, "alert": "FRAUD_ALERT"}
                        return new_state, alert
                    else:
                        new_state = UserState(
                            state_name="SUSPICIOUS",
                            login_timestamp=state.login_timestamp,
                            large_transaction_count=new_count
                        )
                        return new_state, None
                else:
                    return state.copy(), None
        else:
            return state.copy(), None

    return state.copy(), None


def main():
    parser = argparse.ArgumentParser(description="Bytewax Fraud Detection State Machine")
    parser.add_argument("--input", required=True, help="Input JSONlines file path")
    parser.add_argument("--output", required=True, help="Output JSONlines file path")
    args = parser.parse_args()

    flow = Dataflow("fraud_detection")
    
    # 1. Read input line-by-line
    input_stream = op.input("input_file", flow, FileSource(args.input))
    
    # 2. Parse JSON
    parsed_stream = op.map("parse_json", input_stream, json.loads)
    
    # 3. Key by user_id
    keyed_stream = op.key_on("key_by_user", parsed_stream, lambda x: x["user_id"])
    
    # 4. Stateful map for transitions
    state_stream = op.stateful_map("state_machine", keyed_stream, transition)
    
    # 5. Filter out non-alerts and format as JSON strings
    def format_alert(val):
        if val is not None:
            return json.dumps(val)
        return None

    formatted_stream = op.filter_map_value("filter_alerts", state_stream, format_alert)
    
    # 6. Output to file
    op.output("output_file", formatted_stream, FileSink(Path(args.output)))
    
    # Run the dataflow
    run_main(flow)


if __name__ == "__main__":
    main()
