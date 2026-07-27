"""Sample workflow used to demonstrate prioritized work-queue routing."""

import time

from prefect import flow, task


@task
def do_work(label: str) -> str:
    print(f"[{label}] performing unit of work...")
    time.sleep(1)
    result = f"[{label}] work complete"
    print(result)
    return result


@flow(name="routing-flow", log_prints=True)
def routing_flow(label: str = "default") -> str:
    return do_work(label)


if __name__ == "__main__":
    routing_flow()
