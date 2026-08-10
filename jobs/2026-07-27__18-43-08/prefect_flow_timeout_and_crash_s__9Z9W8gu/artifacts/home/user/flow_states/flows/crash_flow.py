"""Flow that deterministically ends in the **Crashed** terminal state.

Unlike the Failed flow, this run is not aborted by an exception raised in
workflow code. Instead, `run_all.py` sends a real SIGTERM to this flow's OS
process while it is running -- a genuine infrastructure-level interruption
(the same kind of signal a container orchestrator sends when killing a
worker's infrastructure). Prefect's flow engine installs a SIGTERM handler
for the duration of the run (see `prefect.utilities.engine.capture_sigterm`)
that converts the signal into a `TerminationSignal`, which the engine
reports to the server as a Crashed state before the process actually dies.
"""

import time

from prefect import flow

from flows.common import CRASH_FLOW_NAME

READY_MARKER = "CRASH_FLOW_READY_FOR_SIGTERM"


@flow(name=CRASH_FLOW_NAME, flow_run_name=CRASH_FLOW_NAME)
def crash_flow() -> None:
    # This marker tells the orchestrating process (run_all.py) that the flow
    # run has actually started executing (i.e. the engine's SIGTERM handler
    # is installed) and it is now safe to deliver the "infrastructure" kill
    # signal.
    print(READY_MARKER, flush=True)
    for i in range(120):
        print(f"[{CRASH_FLOW_NAME}] tick {i}, waiting to be crashed...", flush=True)
        time.sleep(1)
    print(f"[{CRASH_FLOW_NAME}] This line should never be reached.")


if __name__ == "__main__":
    crash_flow()
