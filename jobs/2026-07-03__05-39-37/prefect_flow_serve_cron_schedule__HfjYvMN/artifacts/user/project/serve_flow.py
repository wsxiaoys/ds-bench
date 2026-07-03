"""
Prefect flow that loads a Secret block and serves it with a cron schedule.

This script defines a flow named `my_flow` that:
  1. Loads the `my-api-key` Secret block from Prefect.
  2. Prints its value.

The flow is served as a deployment named `my-deployment` with a cron
schedule of `0 9 * * *` (every day at 09:00 UTC).
"""

from prefect import flow
from prefect.blocks.system import Secret


@flow(name="my_flow")
def my_flow():
    """Load the my-api-key Secret block and print its value."""
    api_key_block = Secret.load("my-api-key")
    api_key = api_key_block.get()
    print(f"API Key value: {api_key}")
    return api_key


if __name__ == "__main__":
    # Serve the flow with a cron schedule running daily at 09:00 UTC
    my_flow.serve(
        name="my-deployment",
        cron="0 9 * * *",
    )