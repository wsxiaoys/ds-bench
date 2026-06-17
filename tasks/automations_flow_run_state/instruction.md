# Prefect Flow Run State Automations

## Background
Prefect allows you to execute specific actions automatically when a flow run changes state (e.g., completes or fails). You can attach state change hooks directly to flows to perform side effects like logging, sending notifications, or cleaning up resources.

## Requirements
- Create a Python script `flow_hooks.py` in the project directory.
- Define a success hook `on_success_hook` that writes the exact text `Success!` to `/home/user/myproject/success.log`.
- Define a failure hook `on_failure_hook` that writes the exact text `Failed!` to `/home/user/myproject/failure.log`.
- Create a Prefect flow named `successful_flow` that attaches the `on_success_hook` to the `on_completion` event. This flow should execute without errors.
- Create a Prefect flow named `failing_flow` that attaches the `on_failure_hook` to the `on_failure` event. This flow must raise a `ValueError` exception.
- The script must run both flows sequentially. The `failing_flow` should handle the exception or let it propagate, as long as the hook is triggered.

## Implementation Guide
1. Ensure you are in `/home/user/myproject`.
2. Create the `flow_hooks.py` file.
3. Import `flow` from `prefect`.
4. Define the hooks. The hook functions must accept three arguments: `flow`, `flow_run`, and `state`.
5. Define the flows with the `@flow` decorator, passing the hooks as lists to `on_completion` and `on_failure` respectively.
6. Add a standard `if __name__ == '__main__':` block to run `successful_flow()` and then `failing_flow()` (you can use a `try...except` block to catch the `ValueError` so the script finishes cleanly).
7. Run the script with `python flow_hooks.py`.

## Constraints
- Project path: `/home/user/myproject`
- Log files: `/home/user/myproject/success.log` and `/home/user/myproject/failure.log`
- The Prefect local server does not strictly need to be running in the background for local hooks to fire, but you may start it if you prefer.

## Integrations
- None