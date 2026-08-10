import asyncio
import time
from pathlib import Path

from prefect.client.orchestration import get_client
from prefect.events.clients import get_events_client
from prefect.events.schemas.events import Event
from prefect.events.schemas.events import RelatedResource, Resource

RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()
RESOURCE_ID = f"zealt.export.{RUN_ID}"


async def main():
    async with get_events_client() as events_client:
        staged = Event(
            event=f"zealt.export.staged.{RUN_ID}",
            resource=Resource({"prefect.resource.id": RESOURCE_ID}),
        )
        await events_client.emit(staged)
        print("Emitted staged event")

        time.sleep(3)

        approved = Event(
            event=f"zealt.export.approved.{RUN_ID}",
            resource=Resource({"prefect.resource.id": RESOURCE_ID}),
        )
        await events_client.emit(approved)
        print("Emitted approved event")


if __name__ == "__main__":
    asyncio.run(main())
