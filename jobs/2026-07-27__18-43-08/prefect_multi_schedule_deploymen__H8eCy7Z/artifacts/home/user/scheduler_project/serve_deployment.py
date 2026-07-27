"""
Serves a single Prefect flow as a deployment with three simultaneous,
independently-active schedules (cron, interval, rrule), each carrying
its own slug and its own override of the flow's ``channel`` parameter.
"""

from datetime import timedelta

from prefect import flow

from prefect.client.schemas.actions import DeploymentScheduleCreate
from prefect.client.schemas.schedules import CronSchedule, IntervalSchedule, RRuleSchedule

RUN_ID = "zrlebsagut"

FLOW_NAME = f"pulse-sync-{RUN_ID}"
DEPLOYMENT_NAME = f"tri-cadence-{RUN_ID}"


@flow(name=FLOW_NAME)
def pulse_sync(channel: str) -> None:
    """A trivial flow that just reports which channel it was triggered for."""
    print(f"pulse-sync running for channel={channel!r}")


schedules = [
    DeploymentScheduleCreate(
        schedule=CronSchedule(cron="17 6 * * 1", timezone="UTC"),
        active=True,
        slug="weekly-cron-audit",
        parameters={"channel": "cron-weekly"},
    ),
    DeploymentScheduleCreate(
        schedule=IntervalSchedule(interval=timedelta(seconds=900), timezone="UTC"),
        active=True,
        slug="interval-heartbeat",
        parameters={"channel": "interval-15min"},
    ),
    DeploymentScheduleCreate(
        schedule=RRuleSchedule(
            rrule="FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=30;BYSECOND=0",
            timezone="UTC",
        ),
        active=True,
        slug="rrule-biday-report",
        parameters={"channel": "rrule-biday"},
    ),
]


if __name__ == "__main__":
    pulse_sync.serve(
        name=DEPLOYMENT_NAME,
        schedules=schedules,
        parameters={"channel": "default"},
    )
