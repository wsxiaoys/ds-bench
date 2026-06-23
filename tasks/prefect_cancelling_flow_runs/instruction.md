# Cancelling Prefect Flow Runs

## Background
Prefect flow runs can be monitored and managed using the Prefect CLI. Sometimes a flow run might take too long or get stuck in an infinite loop, and you need to cancel it manually without stopping the entire worker or server.

## Requirements
- Start the provided flow script `/home/user/project/flow.py` in the background.
- Find the running flow run for the `infinite_loop_flow` flow.
- Cancel the flow run using the Prefect CLI.

## Constraints
- Project path: `/home/user/project`
- The flow must be cancelled via the Prefect CLI, not by killing the python process directly.