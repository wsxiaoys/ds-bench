from prefect import flow
from prefect.events import DeploymentEventTrigger


@flow(name="webhook-flow")
def webhook_flow(payload: dict | None = None) -> None:
    """A flow that handles webhook events.

    Args:
        payload: Optional event payload. Defaults to an empty dict.
    """
    if payload is None:
        payload = {}
    print("Received event payload")


if __name__ == "__main__":
    webhook_flow.serve(
        name="event-deployment",
        triggers=[
            DeploymentEventTrigger(
                expect={"custom.webhook.received"},
                match={"prefect.resource.id": "my.webhook.resource"},
            )
        ],
    )