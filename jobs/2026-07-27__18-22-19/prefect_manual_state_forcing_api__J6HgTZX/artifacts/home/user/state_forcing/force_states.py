"""Create four flow runs of ``state-forcing-flow`` and force each one into
its assigned final state via the Prefect server API.

Only the local Prefect server (http://127.0.0.1:4200) is used.  State changes
are performed with ``client.set_flow_run_state(..., force=True)`` which
bypasses orchestration logic and persists the requested state directly.
"""

import asyncio

from prefect.client.orchestration import get_client
from prefect.states import Cancelled, Completed, Crashed, Failed

from flow import RUN_ID, state_forcing_flow

# (run name, state factory) for each of the four required runs.
RUN_SPECS = [
    (f"ingest-{RUN_ID}", Completed),
    (f"transform-{RUN_ID}", Failed),
    (f"validate-{RUN_ID}", Cancelled),
    (f"publish-{RUN_ID}", Crashed),
]


async def main() -> None:
    async with get_client() as client:
        for run_name, state_factory in RUN_SPECS:
            # 1. Create the flow run (starts in Pending by default).
            flow_run = await client.create_flow_run(
                flow=state_forcing_flow,
                name=run_name,
            )
            print(f"Created flow run '{run_name}' (id={flow_run.id})")

            # 2. Force the assigned final state via the server API.
            target_state = state_factory(
                message=f"Forced to {state_factory.__name__} via server API"
            )
            result = await client.set_flow_run_state(
                flow_run_id=flow_run.id,
                state=target_state,
                force=True,
            )
            print(
                f"  -> set_state result: status={result.status}, "
                f"details={result.details}"
            )


if __name__ == "__main__":
    asyncio.run(main())