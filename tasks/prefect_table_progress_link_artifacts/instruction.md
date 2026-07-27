# Prefect Observability: Table, Progress, and Link Artifacts with Version History

## Background
You are building a reporting pipeline with Prefect (version 3.8.0) that surfaces rich, human-readable outputs in the local Prefect UI. Instead of plain text logs, the pipeline must publish several *different* kinds of run artifacts that a stakeholder can browse on the Prefect **Artifacts** page and on the pipeline run's detail page.

A local Prefect server is available and must be used as the sole backend. There is no cloud, no external API, and no third-party service involved.

## Requirements
Implement a Prefect flow that, when executed, produces a per-run reporting bundle consisting of three distinct artifact types tied to its run:
1. A **table artifact** that renders a regional sales report as a grid.
2. A **progress artifact** that reflects ingestion progress and reads as fully complete when the run finishes.
3. A **link artifact** that points to a source location and shows a friendly display label.

The pipeline must be safe to run repeatedly: re-running it must accumulate **version history** for the table report under one stable identifier (rather than creating a brand-new, unrelated entry each time), so the UI shows more than one version of that report.

## Fixed input dataset
The table report must be built from exactly this dataset (do not invent other rows or values):

| region | units_sold | unit_price |
| ------ | ---------- | ---------- |
| north  | 120        | 4          |
| south  | 75         | 12         |
| east   | 200        | 3          |
| west   | 50         | 20         |

The rendered table must contain **exactly four columns** with these exact header names, in this order: `region`, `units_sold`, `unit_price`, `revenue`. The `revenue` column is derived per row as `units_sold * unit_price`. Rows must appear in the same order as the dataset above (north, south, east, west). This yields revenue values of 480, 900, 600, and 1000 respectively.

## Implementation Hints
- Project path: /home/user/prefect-artifacts-project
- A local Prefect server is reachable at UI `http://127.0.0.1:4200` and API `http://127.0.0.1:4200/api`. The flow must record its artifacts to this local server (i.e. the running process must be pointed at `PREFECT_API_URL=http://127.0.0.1:4200/api`).
- Command: `python3 pipeline.py` (run from the project path). Executing this command must run the flow and publish the three artifacts for that run.
- Read the current `run-id` from the file `/logs/artifacts/run-id` and use it to suffix every artifact identifier so concurrent trials do not collide. Artifact identifiers may only contain lowercase letters, numbers, and dashes.
- The three artifacts must use these exact stable identifiers (where `<run-id>` is the trimmed contents of `/logs/artifacts/run-id`):
  - Table report identifier: `regional-sales-report-<run-id>`
  - Progress identifier: `ingest-progress-<run-id>`
  - Link identifier: `source-link-<run-id>`
- The progress artifact must read as 100% (fully complete) once a run has finished.
- The link artifact must target `http://127.0.0.1:4200/api/health` and display the exact label text `Regional Sales Source`.
- All three artifacts must be discoverable on the Prefect UI **Artifacts** page (found by their identifiers above) and must also appear on the corresponding pipeline run's detail page.
- Because the identifiers are stable across runs, running the flow more than once must add new versions of the table report under the same identifier (visible as multiple versions in the UI), not a differently-named artifact each time.

