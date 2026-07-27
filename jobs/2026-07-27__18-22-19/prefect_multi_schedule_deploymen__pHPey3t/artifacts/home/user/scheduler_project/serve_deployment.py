"""
Serve a single Prefect deployment of one flow with three simultaneously-active
schedules (cron, interval, rrule), each carrying its own slug and `channel`
parameter override.

Target: local, self-hosted Prefect server (API http://127.0.0.1:4200/api).
Run as a long-running local process:

    python3 /home/user/scheduler_project/serve_deployment.py
"""

import os
from pathlib import Path

# --- Target the local Prefect server only (no remote/cloud backend) ----------
os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4200/api")
# Keep results/schedules local; never talk to Prefect Cloud.
os.environ.setdefault("PREFECT_SERVER_API_HOST", "127.0.0.1")

from prefect import flow
from prefect.schedules import Cron, Interval, RRule


def _read_run_id() -> str:
    """Read the run-id artifact and strip any surrounding whitespace/newlines."""
    run_id_path = Path("/logs/artifacts/run-id")
    run_id = run_id_path.read_text(encoding="utf-8").strip()
    # The run-id value is expected to match zr[a-z0-9]+
    return run_id


RUN_ID = _read_run_id()

FLOW_NAME = f"pulse-sync-{RUN_ID}"
DEPLOYMENT_NAME = f"tri-cadence-{RUN_ID}"


@flow(name=FLOW_NAME)
def pulse_sync(channel: str) -> str:
    """Single flow with exactly one string parameter: `channel`.

    The three schedules attached to the deployment each override `channel`
    with their own value, so every scheduled run reports which schedule
    triggered it.
    """
    print(f"pulse-sync[{channel}] running on channel={channel!r}")
    return channel


def build_schedules():
    """Build the three active schedules for the single deployment.

    All schedules use the UTC timezone and are active (not paused).
    """
    tz = "UTC"

    # 1) Cron schedule: every Monday at 06:17 UTC
    cron_schedule = Cron(
        "17 6 * * 1",
        timezone=tz,
        active=True,
        slug="weekly-cron-audit",
        parameters={"channel": "cron-weekly"},
    )

    # 2) Interval schedule: every 900 seconds (15 minutes)
    interval_schedule = Interval(
        900,
        timezone=tz,
        active=True,
        slug="interval-heartbeat",
        parameters={"channel": "interval-15min"},
    )

    # 3) RRule schedule: every 2 days at 09:30:00 UTC
    rrule_schedule = RRule(
        "FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=30;BYSECOND=0",
        timezone=tz,
        active=True,
        slug="rrule-biday-report",
        parameters={"channel": "rrule-biday"},
    )

    return [cron_schedule, interval_schedule, rrule_schedule]


if __name__ == "__main__":
    # `serve` registers exactly ONE deployment (named DEPLOYMENT_NAME) of the
    # single flow and keeps this process running as a long-running local runner
    # that polls for scheduled work. The server will actively create upcoming
    # scheduled runs for the deployment while this process stays alive.
    pulse_sync.serve(
        name=DEPLOYMENT_NAME,
        schedules=build_schedules(),
        paused=False,  # schedules must be active, not paused
        pause_on_shutdown=False,  # leave schedules active if process stops
        print_starting_message=True,
    )