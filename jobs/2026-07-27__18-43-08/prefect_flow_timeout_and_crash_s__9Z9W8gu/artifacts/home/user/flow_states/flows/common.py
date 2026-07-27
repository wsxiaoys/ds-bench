"""Shared helpers for the flow_states project.

All three flows read the shared `run-id` artifact so their names can be
uniquely suffixed (as required by the task) and point at the same local
Prefect OSS server.
"""

import os

RUN_ID_PATH = "/logs/artifacts/run-id"
PREFECT_API_URL = "http://127.0.0.1:4200/api"

# Make sure every process (this one and any subprocess that imports this
# module) talks to the local Prefect server, regardless of profile state.
os.environ.setdefault("PREFECT_API_URL", PREFECT_API_URL)


def get_run_id() -> str:
    with open(RUN_ID_PATH) as f:
        return f.read().strip()


RUN_ID = get_run_id()

TIMEOUT_FLOW_NAME = f"timeout-flow-{RUN_ID}"
CRASH_FLOW_NAME = f"crash-flow-{RUN_ID}"
FAILURE_FLOW_NAME = f"failure-flow-{RUN_ID}"
