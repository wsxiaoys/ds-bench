"""
Idempotently (re)creates the two "scheduling lab" deployments against the
local Prefect server (http://127.0.0.1:4200/api).

  * pulse-active-<run-id>
      Carries an ACTIVE schedule that fires on a fixed 30 second interval.
      Nothing ever consumes/executes these scheduled runs (no worker, no
      agent, no `flow.serve()`), so the server's built-in "late runs"
      service marks the oldest overdue run(s) as Late, and they visibly
      pile up in the UI.

  * pulse-paused-<run-id>
      Carries the same 30 second interval schedule, but the schedule is
      created with `active=False` AND the deployment itself is created
      with `paused=True`. Either flag alone is enough to stop the
      scheduler from producing new runs (see
      prefect/server/services/scheduler.py), but both are set here so the
      UI unambiguously shows the schedule "switched off" with nothing
      queued ahead, regardless of which toggle is inspected.

This script only registers deployment metadata via `RunnerDeployment.apply()`
(a thin wrapper around the REST API's upsert-by-name deployment endpoint).
It never starts a worker, agent, or long-running process, so it can never
execute a scheduled flow run itself. Re-running it simply re-applies the
same deployment definitions (upsert), converging to the same end state.
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from prefect.schedules import Schedule

from flow import pulse

RUN_ID_FILE = Path("/logs/artifacts/run-id")
SCHEDULE_INTERVAL = timedelta(seconds=30)


def get_run_id() -> str:
    """Read the run id, preferring the value exported by setup.sh."""
    env_run_id = os.environ.get("SCHEDULING_LAB_RUN_ID")
    if env_run_id:
        return env_run_id.strip()
    return RUN_ID_FILE.read_text().strip()


def main() -> None:
    run_id = get_run_id()
    if not run_id:
        raise SystemExit(f"run-id read from {RUN_ID_FILE} was empty")

    active_name = f"pulse-active-{run_id}"
    paused_name = f"pulse-paused-{run_id}"

    # -- Deployment 1: active schedule, nothing consumes its runs -> Late ---
    active_deployment = pulse.to_deployment(
        name=active_name,
        description=(
            "Actively scheduled every 30s. No worker/agent executes its "
            "runs, so scheduled runs become overdue and surface as Late."
        ),
        tags=["scheduling-lab", "active", run_id],
        schedule=Schedule(interval=SCHEDULE_INTERVAL, active=True),
        paused=False,
    )
    active_id = active_deployment.apply()
    print(f"Applied '{active_name}' (id={active_id}) with an ACTIVE 30s schedule.")

    # -- Deployment 2: schedule explicitly turned off -> no upcoming runs --
    paused_deployment = pulse.to_deployment(
        name=paused_name,
        description=(
            "30s schedule that has been turned off (inactive), on a "
            "deployment that is itself paused. No runs are queued."
        ),
        tags=["scheduling-lab", "paused", run_id],
        schedule=Schedule(interval=SCHEDULE_INTERVAL, active=False),
        paused=True,
    )
    paused_id = paused_deployment.apply()
    print(
        f"Applied '{paused_name}' (id={paused_id}) with an INACTIVE/paused schedule."
    )


if __name__ == "__main__":
    main()
