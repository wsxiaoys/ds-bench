import asyncio
from pathlib import Path

from prefect.client.orchestration import get_client
from prefect.events.actions import RunDeployment
from prefect.events.schemas.automations import (
    AutomationCore,
    EventTrigger,
    Posture,
    SequenceTrigger,
)

RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()

DEPLOYMENT_NAME = f"guarded-export-{RUN_ID}"
AUTOMATION_NAME = f"seq-guard-automation-{RUN_ID}"
STAGED_EVENT = f"zealt.export.staged.{RUN_ID}"
APPROVED_EVENT = f"zealt.export.approved.{RUN_ID}"
RESOURCE_ID = f"zealt.export.{RUN_ID}"


async def main():
    async with get_client() as client:
        deployment = await client.read_deployment_by_name(
            f"guarded-export-flow/{DEPLOYMENT_NAME}"
        )
        print(f"Found deployment {deployment.name} id={deployment.id}")

        staged_trigger = EventTrigger(
            posture=Posture.Reactive,
            expect=[STAGED_EVENT],
            match={"prefect.resource.id": RESOURCE_ID},
            threshold=1,
            within=0,
        )
        approved_trigger = EventTrigger(
            posture=Posture.Reactive,
            expect=[APPROVED_EVENT],
            match={"prefect.resource.id": RESOURCE_ID},
            threshold=1,
            within=0,
        )

        sequence_trigger = SequenceTrigger(
            triggers=[staged_trigger, approved_trigger],
            within=3600,
        )

        automation = AutomationCore(
            name=AUTOMATION_NAME,
            description=(
                "Fires only after zealt.export.staged is observed strictly "
                "before zealt.export.approved for the guarded export resource."
            ),
            enabled=True,
            trigger=sequence_trigger,
            actions=[RunDeployment(deployment_id=deployment.id, parameters={})],
        )

        # Remove any pre-existing automation with the same name to keep this idempotent.
        existing = await client.read_automations_by_name(name=AUTOMATION_NAME)
        for a in existing:
            print(f"Deleting existing automation {a.id}")
            await client.delete_automation(a.id)

        created = await client.create_automation(automation)
        print(f"Created automation id={created}")


if __name__ == "__main__":
    asyncio.run(main())
