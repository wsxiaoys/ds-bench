# Task Run Concurrency Limits

## Background
You have a Prefect project that processes large amounts of data. The `process_data` task is resource-intensive and should not run too many instances concurrently to avoid memory issues.

## Requirements
- Set a task run concurrency limit of `2` for the tag `heavy-processing` using the Prefect CLI.
- Modify `/home/user/project/flow.py` to apply the `heavy-processing` tag to the `process_data` task.

## Constraints
- Project path: /home/user/project
- Do not change the logic inside the tasks or flows.
- Ensure you are using the tag-based concurrency limits.