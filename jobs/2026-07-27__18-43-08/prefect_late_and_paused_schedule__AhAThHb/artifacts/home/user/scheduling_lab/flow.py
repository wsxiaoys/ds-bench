"""A minimal demo flow used to illustrate deployment scheduling states.

This flow intentionally does almost nothing -- it exists purely so that we
can attach two deployments to it and observe their scheduling behavior in
the Prefect UI. It is never actually executed as part of this lab: no
worker, agent, or `flow.serve()` process is started, so any flow runs the
server's scheduler creates for these deployments will simply sit in
Scheduled/Late state, which is exactly the point of the exercise.
"""

from prefect import flow


@flow(log_prints=True)
def pulse(message: str = "pulse") -> str:
    print(f"pulse flow ran with message={message!r}")
    return message


if __name__ == "__main__":
    pulse()
