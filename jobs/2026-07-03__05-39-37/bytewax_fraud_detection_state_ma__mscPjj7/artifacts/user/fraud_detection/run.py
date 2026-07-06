#!/usr/bin/env python3
"""Bytewax dataflow for stateful fraud detection.

Reads user events from a JSONlines file, drives a per-``user_id`` state
machine (see :mod:`state_machine`) using Bytewax's
:func:`bytewax.operators.stateful_map`, and writes any emitted fraud
alerts to an output JSONlines file.

Usage
-----

.. code-block:: bash

    python run.py --input input.jsonl --output output.jsonl

Input JSONlines schema
----------------------
Each line is a JSON object with the following fields:

* ``user_id``     (string)  -- identifies the user (the state key).
* ``event_type``  (string)  -- one of ``"login"``, ``"transaction"``,
  ``"logout"``.
* ``amount``      (number, optional) -- transaction amount.
* ``timestamp``   (integer) -- event time in seconds.

Output JSONlines schema
-----------------------
Each emitted line is a JSON object with:

* ``user_id`` (string)
* ``alert``   (string) -- always ``"FRAUD_ALERT"``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Tuple

from bytewax.connectors.files import FileSink, FileSource
from bytewax.dataflow import Dataflow
import bytewax.operators as op

from state_machine import update_state


# ---------------------------------------------------------------------------
# Pipeline step functions
# ---------------------------------------------------------------------------


def parse_line(line: str) -> Dict[str, Any]:
    """Decode a single JSONlines record into a Python dict.

    Blank lines are tolerated (treated as empty / skipped upstream by the
    file connector, but we guard anyway).
    """
    line = line.strip()
    if not line:
        # Returning an empty dict here would break keying downstream; the
        # file connector never yields empty lines, but be defensive.
        raise ValueError("Encountered an empty input line")
    return json.loads(line)


def key_by_user(event: Dict[str, Any]) -> str:
    """Key the stream by ``user_id`` so state is tracked per user."""
    return str(event["user_id"])


def format_alert(alert: Dict[str, str]) -> str:
    """Serialize an emitted alert dict to a single JSON line.

    Used with :func:`bytewax.operators.map_value` so the per-``user_id``
    key is preserved (the :class:`~bytewax.connectors.files.FileSink`
    routes items by their key and writes the value).
    """
    return json.dumps(alert, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Dataflow construction
# ---------------------------------------------------------------------------


def build_flow(input_path: str, output_path: str) -> Dataflow:
    """Construct the fraud-detection Bytewax dataflow.

    :param input_path: Path to the input JSONlines file.
    :param output_path: Path to the output JSONlines file.
    :returns: A ready-to-run :class:`bytewax.dataflow.Dataflow`.
    """
    flow = Dataflow("fraud_detection")

    # 1. Read raw lines from the input file.
    lines = op.input("read_input", flow, FileSource(input_path))

    # 2. Parse each JSONlines record into an event dict.
    events = op.map("parse_json", lines, parse_line)

    # 3. Key the stream by user_id (required for stateful operators).
    keyed = op.key_on("key_by_user", events, key_by_user)

    # 4. Drive the per-user state machine. ``stateful_map`` calls
    #    ``update_state(prev_state, event)`` and keeps the returned state
    #    keyed by user_id.  The emitted value is an alert dict or None.
    alerts = op.stateful_map("state_machine", keyed, update_state)

    # 5. Discard the non-alert (None) emissions, keeping only fraud alerts.
    real_alerts = op.filter_value("keep_alerts", alerts, lambda v: v is not None)

    # 6. Serialize each alert to a single JSON line.  Use ``map_value``
    #    (not ``map``) so the ``user_id`` key is preserved: the FileSink
    #    routes items by their key and writes the value string.
    formatted = op.map_value("format_alert", real_alerts, format_alert)

    # 7. Write the alerts to the output JSONlines file.
    op.output("write_output", formatted, FileSink(Path(output_path)))

    return flow


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bytewax stateful stream processing fraud detector.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the input JSONlines file (user events).",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to the output JSONlines file (fraud alerts).",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = _parse_args(argv)

    # Ensure the parent directory exists for the output file.
    out_parent = Path(args.output).parent
    if str(out_parent) and not out_parent.exists():
        out_parent.mkdir(parents=True, exist_ok=True)

    # Pre-create the output file so that it always exists, even when no
    # alerts are emitted (the FileSink only materializes a partition once
    # data flows through it, so an empty run would otherwise leave no
    # file behind).  The sink truncates the file on start, so any prior
    # contents are discarded.
    Path(args.output).touch()

    flow = build_flow(args.input, args.output)

    # Run synchronously in the current thread.  This is the simplest way
    # to execute a finite batch dataflow locally; it blocks until the
    # input source is exhausted.
    from bytewax.testing import run_main

    run_main(flow)
    return 0


if __name__ == "__main__":
    sys.exit(main())