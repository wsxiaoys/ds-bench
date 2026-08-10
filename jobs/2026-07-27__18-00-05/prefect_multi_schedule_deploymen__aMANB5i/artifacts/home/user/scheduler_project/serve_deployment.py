"""
Serve a single Prefect deployment with three simultaneous schedules:
  - cron:  "17 6 * * 1"        slug="weekly-cron-audit"     channel="cron-weekly"
  - interval: 900 seconds       slug="interval-heartbeat"    channel="interval-15min"
  - rrule:  FREQ=DAILY;...      slug="rrule-biday-report"    channel="rrule-biday"
"""
import sys
import asyncio

from prefect import flow, serve
from prefect.runner import Runner
from prefect.schedules import Schedule

# ---------------------------------------------------------------------------
# Read the run-id
# ---------------------------------------------------------------------------
with open("/logs/artifacts/run-id") as f:
    run_id = f.read().strip()

FLOW_NAME = f"pulse-sync-{run_id}"
DEPLOYMENT_NAME = f"tri-cadence-{run_id}"

# ---------------------------------------------------------------------------
# Define the flow
# ---------------------------------------------------------------------------
@flow(name=FLOW_NAME, log_prints=True)
def pulse_sync(channel: str):
    """Flow that receives a channel parameter and logs it."""
    print(f"[pulse-sync] Received on channel: {channel}")


# ---------------------------------------------------------------------------
# Build the three schedules
# ---------------------------------------------------------------------------
cron_schedule = Schedule(
    cron="17 6 * * 1",
    timezone="UTC",
    slug="weekly-cron-audit",
    parameters={"channel": "cron-weekly"},
)

interval_schedule = Schedule(
    interval=900.0,  # seconds
    timezone="UTC",
    slug="interval-heartbeat",
    parameters={"channel": "interval-15min"},
)

rrule_schedule = Schedule(
    rrule="FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=30;BYSECOND=0",
    timezone="UTC",
    slug="rrule-biday-report",
    parameters={"channel": "rrule-biday"},
)

all_schedules = [cron_schedule, interval_schedule, rrule_schedule]

# ---------------------------------------------------------------------------
# Serve the deployment
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Flow name:      {FLOW_NAME}")
    print(f"Deployment:     {DEPLOYMENT_NAME}")
    print(f"Schedules:      {len(all_schedules)}")
    for s in all_schedules:
        print(f"  - slug={s.slug}  params={s.parameters}")

    # Using `serve` with a RunnerDeployment-like approach.
    # `serve` accepts the flow and schedules directly.
    serve(
        pulse_sync.to_deployment(
            name=DEPLOYMENT_NAME,
            schedules=all_schedules,
        ),
        pause_on_shutdown=False,
    )
