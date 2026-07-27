"""Single Prefect flow used by all four runs in this task.

The flow code itself is intentionally uniform: every invocation returns the
same value.  Any divergence in the *final* state of the four runs is achieved
exclusively through Prefect's server-side API (``set_flow_run_state`` with
``force=True``), never by modifying the flow's behaviour.
"""

from prefect import flow

# Read the run-id that must be appended to every flow / flow-run name.
with open("/logs/artifacts/run-id") as fh:
    RUN_ID = fh.read().strip()

FLOW_NAME = f"state-forcing-flow-{RUN_ID}"


@flow(name=FLOW_NAME)
def state_forcing_flow() -> str:
    """A trivial flow whose natural outcome is always ``Completed``.

    All four runs share this single flow definition.  The differing final
    states are imposed from the server side, not from within this code.
    """
    return "executed"