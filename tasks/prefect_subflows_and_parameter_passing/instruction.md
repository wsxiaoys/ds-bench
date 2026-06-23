# Prefect Subflows and Parameter Passing

## Background
Prefect allows you to compose complex workflows by calling flows from within other flows, known as subflows. This task involves creating a parent flow that accepts parameters and passes them down to multiple subflows to process data.

## Requirements
- Create a Python script `main.py` in `/home/user/project`.
- Define a subflow named `process_item` that takes a string parameter `item` and a boolean `uppercase`, and returns the processed string (uppercased if True, else lowercased).
- Define a parent flow named `main_flow` that takes a list of strings and a boolean `uppercase` flag.
- The parent flow must iterate over the list and call the `process_item` subflow for each item, passing the `uppercase` flag.
- The parent flow should return the list of processed strings.
- Add a block of code at the bottom of `main.py` to execute `main_flow` with the arguments `items=["apple", "Banana", "cherry"]` and `uppercase=True`, and print the result to a log file `/home/user/project/output.log`.

## Constraints
- Project path: `/home/user/project`
- Log file: `/home/user/project/output.log`
- Must use Prefect `@flow` decorators for both the parent flow and the subflow.
- Do not use `@task` for this specific exercise, only subflows.
- The script must be executable via `python main.py`.