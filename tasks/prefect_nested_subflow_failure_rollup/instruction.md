# Nested Workflow Failure Roll-up with Prefect

## Background
You are working with Prefect (pinned to version 3.4.25) and a locally running Prefect server. Real data platforms compose deep hierarchies of workflows: a top-level orchestration workflow calls child workflows, and those children call their own grandchild workflows. When a deeply nested step fails, operators need the failure to surface ("roll up") along its ancestor chain while unrelated sibling branches still finish their own work. Your job is to build such a hierarchy and drive it once so that the full nesting and every node's terminal state are observable in the local Prefect UI.

## Requirements
- Build a top-level workflow that orchestrates a hierarchy of nested workflows that is **exactly three levels deep along one branch** (top-level -> a child workflow -> a grandchild workflow).
- The top-level workflow must, within a single run, drive both of its child branches described below, and every node in the hierarchy must be recorded as its own flow run on the local Prefect server so the parent/child relationships render in the UI flow-run graph.
- One specific grandchild (level-3) workflow must **deterministically fail** every time it runs.
- A sibling child (level-2) workflow that is not on the failing branch must **run to a successful terminal state**, independent of the failing branch.
- The failure of the grandchild must **roll up** so that its parent branch and the top-level workflow both reach a failed terminal state, while the sibling branch remains successful. The whole hierarchy, with each node's individual terminal state, must be visible when opening the top-level flow run in the UI.

## Implementation Hints
- Project path: /home/user/nested_pipeline
- Read the `run-id` from `/logs/artifacts/run-id` and append it, separated by a single hyphen, as the suffix of every workflow's registered name (e.g. base name `foo` becomes `foo-<run-id>`).
- A Prefect server is available locally. Its UI is at `http://127.0.0.1:4200` and its API is at `http://127.0.0.1:4200/api` (port 4200). All flow runs your solution produces MUST be recorded on this local server so they appear in the UI.
- The exact registered workflow names (each suffixed with `-<run-id>`) and the exact call hierarchy MUST be:
  - Top-level workflow: `orders-pipeline-<run-id>`. It directly invokes the two level-2 workflows below.
  - Level-2 sibling workflow (successful branch): `inventory-sync-<run-id>`. It performs its own work and does not invoke any deeper workflow.
  - Level-2 workflow on the failing branch: `billing-rollup-<run-id>`. It directly invokes the level-3 workflow below.
  - Level-3 grandchild workflow (the deterministic failure): `charge-settlement-<run-id>`, invoked only by `billing-rollup-<run-id>`.
- The exact terminal state each node MUST reach after one drive of the top-level workflow:
  - `charge-settlement-<run-id>`: Failed
  - `billing-rollup-<run-id>`: Failed
  - `inventory-sync-<run-id>`: Completed
  - `orders-pipeline-<run-id>`: Failed
- Run command: `python3 /home/user/nested_pipeline/main.py`. Running this command once must execute the top-level workflow a single time against the local server and produce exactly the hierarchy and terminal states above. Because the top-level workflow ends in a failed terminal state, this command is expected to exit with a non-zero status; that is correct and intended.

