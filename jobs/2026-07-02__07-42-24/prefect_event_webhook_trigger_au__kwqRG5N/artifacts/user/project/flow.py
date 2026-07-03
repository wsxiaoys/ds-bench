from prefect import flow
from prefect.events import DeploymentEventTrigger

@flow(name="webhook-flow", log_prints=True)
def webhook_flow(payload: dict = {}):
    print("Received event payload")

if __name__ == "__main__":
    webhook_flow.serve(
        name="event-deployment",
        triggers=[
            DeploymentEventTrigger(
                expect={"custom.webhook.received"},
                match={"prefect.resource.id": "my.webhook.resource"},
                parameters={
                    "payload": {
                        "__prefect_kind": "json",
                        "value": {
                            "__prefect_kind": "jinja",
                            "template": "{{ event.payload | tojson }}",
                        }
                    }
                }
            )
        ]
    )
