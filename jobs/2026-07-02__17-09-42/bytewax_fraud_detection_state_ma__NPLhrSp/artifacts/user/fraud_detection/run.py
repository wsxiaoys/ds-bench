#!/usr/bin/env python3
"""Bytewax fraud-detection dataflow.

Reads user events from a JSON-lines file, tracks per-user state via a
stateful state machine, and emits a fraud alert when a user
accumulates three or more "large" transactions (>= 1000) within 300
seconds of their most recent login.

Usage::

    python run.py --input input.jsonl --output output.jsonl

Input JSONL fields (one event per line):
    user_id     (str)
    event_type  (str: "login" | "transaction" | "logout")
    amount      (number, optional - present for transactions)
    timestamp   (int, seconds since epoch)

Output JSONL fields (one alert per line):
    user_id     (str)
    alert       (str: "FRAUD_ALERT")
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from bytewax import operators as op
from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
from bytewax.operators import stateful_map
from bytewax.run import cli_main


# ---------------------------------------------------------------------------
# State-machine constants
# ---------------------------------------------------------------------------
LOGGED_OUT = "LOGGED_OUT"
LOGGED_IN = "LOGGED_IN"
SUSPICIOUS = "SUSPICIOUS"

LARGE_TX_AMOUNT = 1000          # threshold for a "large" transaction
LARGE_TX_COUNT_LIMIT = 3        # # of large tx's that trigger an alert
LOGIN_WINDOW_SECONDS = 300      # 5 minutes


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------
def initial_state() -> Dict[str, Any]:
    """Return a fresh, effectively-immutable state for a brand-new user."""
    return {
        "state": LOGGED_OUT,
        "login_timestamp": None,
        "large_tx_count": 0,
    }


def reset_state() -> Dict[str, Any]:
    """Return a reset state (logged out, no counter, no login recorded)."""
    return {
        "state": LOGGED_OUT,
        "login_timestamp": None,
        "large_tx_count": 0,
    }


def evolve(base: Dict[str, Any], **overrides: Any) -> Dict[str, Any]:
    """Return a *new* state dict with the given fields overridden.

    This satisfies the Bytewax guideline that state must be effectively
    immutable - we never mutate the incoming ``base`` dict.
    """
    return {**base, **overrides}


# ---------------------------------------------------------------------------
# Core state-machine step function
# ---------------------------------------------------------------------------
def step(
    state: Optional[Dict[str, Any]], event: Dict[str, Any]
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """Advance the per-user state machine by one event.

    Returns ``(new_state, output)`` where ``output`` is either ``None``
    (no alert, just keep state) or a fraud-alert dict that should be
    written to the output file.
    """
    # First event for a key: ``stateful_map`` calls us with ``None``.
    if state is None:
        state = initial_state()

    event_type = event.get("event_type")
    timestamp = event.get("timestamp")
    user_id = event.get("user_id")
    amount = event.get("amount", 0) or 0

    # -----------------------------------------------------------------
    # LOGIN  ->  transition to LOGGED_IN, record timestamp, clear counter.
    # -----------------------------------------------------------------
    if event_type == "login":
        return (
            evolve(
                state,
                state=LOGGED_IN,
                login_timestamp=timestamp,
                large_tx_count=0,
            ),
            None,
        )

    # -----------------------------------------------------------------
    # LOGOUT  ->  immediately drop back to LOGGED_OUT.
    # -----------------------------------------------------------------
    if event_type == "logout":
        return (reset_state(), None)

    # -----------------------------------------------------------------
    # TRANSACTION  ->  apply the rules in order.
    # -----------------------------------------------------------------
    if event_type == "transaction":
        # Rule: when LOGGED_OUT, a transaction is ignored entirely.
        if state["state"] == LOGGED_OUT:
            return (evolve(state), None)

        login_ts = state["login_timestamp"]
        # Rule: a transaction more than 300 s after the last login
        #       resets the state and ignores *this* transaction.
        if login_ts is not None and (timestamp - login_ts) > LOGIN_WINDOW_SECONDS:
            return (reset_state(), None)

        # Rule: large transactions bump the counter and move the user
        #       to SUSPICIOUS.  Small transactions are ignored.
        if amount >= LARGE_TX_AMOUNT:
            new_count = state["large_tx_count"] + 1

            # Rule: 3 large tx's in the window => emit fraud alert
            #       and reset the user back to LOGGED_OUT.
            if new_count >= LARGE_TX_COUNT_LIMIT:
                alert = {"user_id": user_id, "alert": "FRAUD_ALERT"}
                return (reset_state(), alert)

            return (
                evolve(state, state=SUSPICIOUS, large_tx_count=new_count),
                None,
            )

        # Small transaction: keep current state, no counter change.
        return (evolve(state), None)

    # Unknown event types: pass through silently.
    return (evolve(state), None)


# ---------------------------------------------------------------------------
# Dataflow construction
# ---------------------------------------------------------------------------
def build_flow(input_path: str, output_path: str) -> Dataflow:
    """Wire up the fraud-detection dataflow.

    The dataflow follows these steps::

        FileSource  ->  parse JSON  ->  key by user_id
                    ->  stateful_map (state machine)
                    ->  filter_map (keep only alerts)
                    ->  FileSink (one alert per line)
    """
    flow = Dataflow("fraud_detection")

    # 1. Source: a JSON-lines file.  Each item is one raw line (str).
    raw_lines = op.input("input", flow, FileSource(input_path))

    # 2. Parse each line as a JSON event dict.
    events = op.map("parse_json", raw_lines, json.loads)

    # 3. Key by user_id so that each user's state is independent.
    keyed = op.key_on("by_user", events, lambda e: e["user_id"])

    # 4. Stateful step: the per-user state machine.
    #    ``stateful_map`` emits ``(user_id, output_dict_or_None)``.
    stateful = stateful_map("state_machine", keyed, step)

    # 5. The output of ``stateful_map`` is already ``(user_id, alert_dict
    #    | None)``.  Drop the user_id key and serialise the (possibly
    #    missing) alert dict as a JSON string so FileSink can write it.
    def to_alert(item: Tuple[str, Optional[Dict[str, Any]]]) -> Optional[str]:
        _user_key, alert = item
        if alert is None:
            return None
        return json.dumps(alert)

    alerts = op.filter_map("alerts_only", stateful, to_alert)

    # 6. FileSink is a FixedPartitionedSink that expects ``(key, value)``
    #    tuples so it can route items to partitions.  We just want one
    #    partition so we attach a constant key to every alert.
    keyed_alerts = op.key_on("to_one_part", alerts, lambda _alert: "output")

    # 7. Sink: append each alert as its own line to the output file.
    op.output("output", keyed_alerts, FileSink(output_path))

    return flow


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bytewax fraud-detection state machine."
    )
    parser.add_argument("--input", required=True, help="Input JSONL file")
    parser.add_argument("--output", required=True, help="Output JSONL file")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args(sys.argv[1:])

    if not os.path.isfile(args.input):
        print(f"error: input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    # FileSink opens in append-mode and creates the file if missing,
    # but the parent directory must already exist.
    output_p = Path(args.output)
    output_p.parent.mkdir(parents=True, exist_ok=True)
    # Guarantee the target file exists so single-worker setups work.
    output_p.touch(exist_ok=True)

    flow = build_flow(args.input, str(output_p))
    cli_main(flow)


if __name__ == "__main__":
    main()
