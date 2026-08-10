"""
Defines a single Prefect flow and creates four flow runs of it,
then forces each run into a specific, assigned final state using
Prefect's server-side API/client (not by tailoring the flow code).

Run-id: zr0gly72hn
"""

import asyncio

from prefect import flow
from prefect.client.orchestration import get_client
from prefect.client.schemas.filters import FlowRunFilter, FlowRunFilterName
from prefect.states import Cancelled, Completed, Crashed, Failed

RUN_ID = "zr0gly72hn"
FLOW_NAME = f"state-forcing-flow-{RUN_ID}"

# Mapping of flow-run name -> forced final state
RUN_STATE_PLAN = {
    f"ingest-{RUN_ID}": Completed,
    f"transform-{RUN_ID}": Failed,
    f"validate-{RUN_ID}": Cancelled,
    f"publish-{RUN_ID}": Crashed,
}


@flow(name=FLOW_NAME)
def state_forcing_flow():
    """A simple flow whose own execution always succeeds.

    Its natural outcome (Completed) will be overridden server-side
    for three of the four runs so that the persisted final states
    are Completed / Failed / Cancelled / Crashed respectively.
    """
    print("Running state_forcing_flow...")
    return "ok"


async def force_states():
    async with get_client() as client:
        for run_name, state_factory in RUN_STATE_PLAN.items():
            # 1. Execute the flow normally, producing a real flow run
            #    with the given name. The flow itself always succeeds.
            state_forcing_flow.with_options(flow_run_name=run_name)()

            # 2. Look up the flow run that was just created by name.
            flow_runs = await client.read_flow_runs(
                flow_run_filter=FlowRunFilter(
                    name=FlowRunFilterName(any_=[run_name])
                )
            )
            if not flow_runs:
                raise RuntimeError(f"Could not find flow run named {run_name!r}")
            flow_run = flow_runs[0]

            # 3. Force the run's final state via the server-side API,
            #    regardless of what the run's own execution produced.
            desired_state = state_factory(message=f"Forced to {state_factory.__name__} via API")
            await client.set_flow_run_state(
                flow_run_id=flow_run.id,
                state=desired_state,
                force=True,
            )
            print(f"Forced flow run {run_name!r} ({flow_run.id}) -> {state_factory.__name__}")


if __name__ == "__main__":
    asyncio.run(force_states())
