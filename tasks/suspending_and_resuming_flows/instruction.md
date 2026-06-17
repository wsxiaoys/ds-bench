# Suspending and Resuming Flows

## Background
Prefect allows you to pause a flow run, blocking its execution until it is manually resumed. This is useful for workflows that require human approval or intervention before proceeding to subsequent tasks.

## Requirements
- Create a Prefect flow named `my_pausing_flow` in `/home/user/app/flow.py`.
- The flow must contain two tasks: `task_one` and `task_two`.
- `task_one` should print the exact string `"Task 1 complete"`.
- `task_two` should print the exact string `"Task 2 complete"`.
- The flow must call `task_one`, then pause itself using `pause_flow_run` with a timeout of 3600 seconds, and finally call `task_two`.
- The script must execute the flow when run directly (e.g., using `if __name__ == "__main__":`).

## Implementation Guide
1. Ensure you are working in `/home/user/app`.
2. Write the `flow.py` script using `@flow`, `@task`, and `pause_flow_run` from `prefect.flow_runs`.
3. Do not use `suspend_flow_run`, as it requires additional deployment configurations. Use `pause_flow_run`.

## Constraints
- Project path: `/home/user/app`
- The flow must be named `my_pausing_flow`.