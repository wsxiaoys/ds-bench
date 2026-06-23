# Prefect State Change Hooks & Notifications

## Background
Prefect allows you to trigger actions based on state changes of flows and tasks using state change hooks. This is useful for sending notifications, cleaning up resources, or triggering external systems when a workflow succeeds, fails, or crashes.

## Requirements
- You have an empty project directory at `/home/user/project`.
- Create a Prefect workflow that uses state change hooks for success and failure notifications.
- The workflow should be defined in `/home/user/project/flow.py`.
- Define two hook functions:
  - `notify_success(flow, flow_run, state)`: Writes the string "Workflow succeeded" to `/home/user/project/success.log`.
  - `notify_failure(flow, flow_run, state)`: Writes the string "Workflow failed" to `/home/user/project/failure.log`.
- Define a flow named `data_pipeline` that accepts a boolean parameter `should_fail`.
- Attach the `notify_success` hook to the flow's `on_completion` event.
- Attach the `notify_failure` hook to the flow's `on_failure` event.
- Inside the flow, if `should_fail` is `True`, raise a `ValueError("Simulated failure")`. Otherwise, return `"Success"`.
- Add a block at the bottom of the file to run the flow twice:
  - First run: `data_pipeline(should_fail=False, return_state=True)`
  - Second run: `data_pipeline(should_fail=True, return_state=True)`
- Run the script to generate the log files.

## Implementation Guide
1. Create `/home/user/project/flow.py` and import the necessary Prefect modules.
2. Implement the hook functions to write to the specified log files.
3. Implement the `data_pipeline` flow with the `@flow` decorator, attaching the hooks.
4. Execute the flow twice at the end of the script, handling the return states to ensure both runs complete.
5. Run `python3 /home/user/project/flow.py` to produce the logs.

## Constraints
- Project path: /home/user/project
- Log file: /home/user/project/success.log, /home/user/project/failure.log