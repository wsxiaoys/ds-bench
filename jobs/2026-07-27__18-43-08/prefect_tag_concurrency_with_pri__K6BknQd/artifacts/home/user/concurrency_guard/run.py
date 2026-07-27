"""
Entrypoint: launches exactly 12 concurrent units of `guarded_pipeline_<run-id>`.

Usage (from the project directory):
    python3 run.py

Each of the 12 units is started concurrently (via asyncio.gather). The hot
resource critical section inside each unit is serialized by the
`hotpath-<run-id>` task-run tag concurrency limit (max 1 running at a time),
while the broader-processing step inside each unit is bounded by the
`throughput-<run-id>` global concurrency limit (3 slots). Both controls must
already be registered on the local Prefect server (see setup_concurrency.py)
before this script is run. All 12 units are expected to reach `Completed`.
"""

from __future__ import annotations

import asyncio

from pipeline import FLOW_NAME, HOT_TAG, RUN_ID, THROUGHPUT_LIMIT_NAME, run_all_units

TOTAL_UNITS = 12


async def main() -> None:
    print(f"run-id                 = {RUN_ID}")
    print(f"flow name              = {FLOW_NAME}")
    print(f"hot tag (limit=1)      = {HOT_TAG}")
    print(f"global limit (3 slots) = {THROUGHPUT_LIMIT_NAME}")
    print(f"Launching {TOTAL_UNITS} concurrent units...")

    results = await run_all_units(TOTAL_UNITS)

    print(f"All {len(results)} units finished:")
    for r in sorted(results, key=lambda x: x["unit_id"]):
        print(f"  unit {r['unit_id']:>2}: {r['critical']} | {r['processing']}")


if __name__ == "__main__":
    asyncio.run(main())
