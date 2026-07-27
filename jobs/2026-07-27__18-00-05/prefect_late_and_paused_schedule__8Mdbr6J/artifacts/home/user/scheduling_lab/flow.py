"""
A simple pulse flow that logs a heartbeat message.
Used to demonstrate scheduling lifecycle states in the Prefect UI.
"""

from prefect import flow


@flow(name="pulse-flow", log_prints=True)
def pulse_flow():
    print("💓 Pulse heartbeat")
