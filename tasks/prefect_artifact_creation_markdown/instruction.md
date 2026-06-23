# Create a Markdown Artifact using Prefect

## Background
Prefect provides an `Artifacts` API to publish data and visual reports directly to the Prefect backend. You have a pre-written Python script that defines a Prefect flow to generate a markdown report.

## Requirements
- Run the provided Python script `flow.py` to execute the flow and create a markdown artifact in the Prefect backend.
- Redirect the output of the script to a log file.

## Implementation Guide
1. Navigate to the project directory.
2. Execute the script `flow.py` using Python and redirect both stdout and stderr to `output.log`.

## Constraints
- Project path: /home/user/project
- Log file: /home/user/project/output.log
