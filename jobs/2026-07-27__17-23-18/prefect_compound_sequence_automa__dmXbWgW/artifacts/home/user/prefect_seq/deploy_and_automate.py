import asyncio
from prefect import flow
from prefect.automations import Automation
from prefect.events.schemas.automations import SequenceTrigger, EventTrigger
from prefect.events.actions import RunDeployment

@flow(name="guarded-export-zrwr4k6h6l")
def guarded_export_flow():
    print("Guarded export flow is starting!")
    print("Export process complete.")

def main():
    print("Deploying flow using from_source...")
    f = flow.from_source(
        source="/home/user/prefect_seq",
        entrypoint="deploy_and_automate.py:guarded_export_flow"
    )
    deployment_id = f.deploy(
        name="guarded-export-zrwr4k6h6l",
        work_pool_name="my-pool",
        ignore_warnings=True
    )
    print(f"Deployment successfully deployed with ID: {deployment_id}")

    print("Creating automation...")
    
    # Constructing triggers
    trigger_staged = EventTrigger(
        type="event",
        posture="Reactive",
        expect=["zealt.export.staged.zrwr4k6h6l"],
        match={
            "prefect.resource.id": "zealt.export.zrwr4k6h6l"
        }
    )
    
    trigger_approved = EventTrigger(
        type="event",
        posture="Reactive",
        expect=["zealt.export.approved.zrwr4k6h6l"],
        match={
            "prefect.resource.id": "zealt.export.zrwr4k6h6l"
        }
    )
    
    sequence_trigger = SequenceTrigger(
        type="sequence",
        triggers=[trigger_staged, trigger_approved],
        within=3600 # 1 hour window
    )
    
    action = RunDeployment(
        type="run-deployment",
        deployment_id=deployment_id,
        source="selected"
    )
    
    automation = Automation(
        name="seq-guard-automation-zrwr4k6h6l",
        description="Gated automation requiring staged then approved events",
        enabled=True,
        trigger=sequence_trigger,
        actions=[action]
    )
    
    created_automation = automation.create()
    print(f"Automation successfully created with ID: {created_automation.id}")

if __name__ == "__main__":
    main()
