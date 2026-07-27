#!/usr/bin/env python3
"""Executable entrypoint that runs the orders ETL flow once per input set.

Runs are recorded against the local Prefect server (http://127.0.0.1:4200/api)
so they appear in the UI at http://127.0.0.1:4200.

Input sets, executed in this order:
    1. region=emea, batch=10
    2. region=apac, batch=25
    3. region=amer, batch=50
"""

from __future__ import annotations

import os
import sys

# Ensure runs are recorded by the local Prefect server (not an ephemeral one).
os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4200/api")

# Make the project importable when run directly.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flows import orders_etl  # noqa: E402


def main() -> None:
    input_sets = [
        ("emea", 10),
        ("apac", 25),
        ("amer", 50),
    ]

    for region, batch in input_sets:
        result = orders_etl(region=region, batch=batch)
        print(f"Completed run region={region} batch={batch} -> {result}")


if __name__ == "__main__":
    main()