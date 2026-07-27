"""Simple flow for work-queue routing demonstration."""
from prefect import flow, task


@task(log_prints=True)
def routing_task(queue_name: str) -> str:
    """A simple task that identifies which queue it was routed through."""
    print(f"Executing task routed through queue: {queue_name}")
    return f"completed-via-{queue_name}"


@flow(log_prints=True)
def routing_flow(queue_name: str = "default") -> str:
    """Flow that demonstrates work-queue routing.

    Args:
        queue_name: The name of the queue this flow run was routed through.
    """
    print(f"Flow started, routed through queue: {queue_name}")
    result = routing_task(queue_name=queue_name)
    print(f"Flow completed with result: {result}")
    return result
