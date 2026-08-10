import sys
from prefect import flow
from prefect.schedules import Cron, Interval, RRule

RUN_ID = "zrcl757afr"

@flow(name=f"pulse-sync-{RUN_ID}")
def pulse_sync(channel: str):
    print(f"Running pulse-sync for channel: {channel}", flush=True)

def main():
    print("Starting serve_deployment.py...", flush=True)
    pulse_sync.serve(
        name=f"tri-cadence-{RUN_ID}",
        schedules=[
            Cron("17 6 * * 1", timezone="UTC", slug="weekly-cron-audit", parameters={"channel": "cron-weekly"}),
            Interval(900, timezone="UTC", slug="interval-heartbeat", parameters={"channel": "interval-15min"}),
            RRule("FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=30;BYSECOND=0", timezone="UTC", slug="rrule-biday-report", parameters={"channel": "rrule-biday"})
        ]
    )

if __name__ == "__main__":
    main()
