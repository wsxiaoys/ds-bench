from prefect import flow
from prefect.events import DeploymentEventTrigger

@flow(name="webhook-flow")
def webhook_flow(payload: dict = {}):
    print("Received event payload")

if __name__ == "__main__":
    webhook_flow.serve(
        name="event-deployment",
        triggers=[
            DeploymentEventTrigger(
                expect={"custom.webhook.received"},
                match={"prefect.resource.id": "my.webhook.resource"}
            )
        ]
    )
