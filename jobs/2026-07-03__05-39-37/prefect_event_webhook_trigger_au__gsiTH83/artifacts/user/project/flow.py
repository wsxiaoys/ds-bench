"""
Event-driven Prefect flow triggered by a custom webhook event.

This flow is served as a deployment named ``event-deployment`` and is
configured with an event trigger that listens for the
``custom.webhook.received`` event on the resource with the ID
``my.webhook.resource``.
"""

from prefect import flow
from prefect.events import DeploymentEventTrigger


@flow(name="webhook-flow")
def webhook_flow(payload: dict = {}):
    """A flow that prints the event payload received from a webhook event.

    Args:
        payload: The event payload delivered by the trigger. Defaults to an
            empty dict when the flow is invoked without one.
    """
    print("Received event payload")
    print(payload)


if __name__ == "__main__":
    webhook_flow.serve(
        name="event-deployment",
        triggers=[
            DeploymentEventTrigger(
                name="webhook-event-trigger",
                expect={"custom.webhook.received"},
                match={"prefect.resource.id": "my.webhook.resource"},
            ),
        ],
    )