# Dynamic, Parameter-Derived Run Names in Prefect

## Background
Prefect 3.x records every flow run and task run on a local server and displays them in its UI. By default each run is given a random, human-unfriendly label (for example `vivid-lemur`). This makes it hard for an operator scanning the UI to tell which inputs produced which run. Your job is to make the runs self-describing: their names must be computed dynamically from each run's own input values so the UI shows meaningful, parameter-derived names instead of the random defaults.

## Requirements
- Build a single Prefect flow that contains at least one task, inside a Python project.
- For every execution, the flow run AND the task run must be recorded under human-readable names that are derived from that run's input values (not the random default names).
- Execute the flow several times, once for each of the exact input sets listed below, recording every run on the local Prefect server so they are visible in the UI.

## Implementation Hints
- Prefect 3.7.8 is already installed. Do not use a different major/minor version.
- Project path: /home/user/pipeline
- A Prefect server must be running locally and must be the API that records the runs. UI: http://127.0.0.1:4200 . API: http://127.0.0.1:4200/api . Port: 4200. Bind to 127.0.0.1 only. Do not use any external, remote, or cloud service.
- Read the run-id from the file /logs/artifacts/run-id (a string matching `zr[a-z0-9]+`). In every name described below, `<run-id>` denotes exactly that run-id value, appended after a literal hyphen.
- The flow's registered flow name (the name of the flow itself, not the name of an individual run) must be exactly `orders-etl-<run-id>`.
- Each flow run's name must follow this exact format: `ingest-{region}-b{batch}-<run-id>`, where `{region}` is that run's region value and `{batch}` is that run's batch value written as plain digits with no padding, placed immediately after the literal character `b`.
- Each task run's name must follow this exact format: `transform-{region}-b{batch}-<run-id>`, using the same region and batch values as its enclosing flow run.
- Provide an executable script at /home/user/pipeline/run_pipeline.py that, when run, executes the flow once for each of the following input sets, in this order:
  1. region = `emea`, batch = `10`
  2. region = `apac`, batch = `25`
  3. region = `amer`, batch = `50`
- After running, all three flow runs and their task runs must be present in the local Prefect UI under the exact names produced by the formats above, and none of them may retain a random default name.

