import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Dict, Any

from pydantic import BaseModel
from llama_cloud import AsyncLlamaCloud


class InvoiceSchema(BaseModel):
    vendor_name: str
    invoice_number: str
    total_amount: float
    line_items: list[str]


DATA_DIR = Path("/home/user/myproject/data")
FILES = ["invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf"]
RESULTS_PATH = Path("/home/user/myproject/results.json")
LOG_PATH = Path("/home/user/myproject/output.log")


async def upload_and_extract(
    client: AsyncLlamaCloud,
    semaphore: asyncio.Semaphore,
    filename: str,
    run_id: str,
) -> tuple[str, Dict[str, Any]]:
    file_path = DATA_DIR / filename
    unique_suffix = uuid.uuid4().hex[:8]
    external_file_id = f"{file_path.stem}-{unique_suffix}-{run_id}"

    async with semaphore:
        with file_path.open("rb") as file_handle:
            uploaded_file = await client.files.create(
                file=file_handle,
                purpose="extract",
                external_file_id=external_file_id,
            )

        job = await client.extract.create(
            file_input=uploaded_file.id,
            configuration={
                "extraction_target": "per_doc",
                "tier": "cost_effective",
                "data_schema": InvoiceSchema.model_json_schema(),
            },
        )

        while True:
            job = await client.extract.get(job.id)
            if job.status in {"COMPLETED", "FAILED", "CANCELLED"}:
                break
            await asyncio.sleep(2.5)

        status = job.status
        log_line = f"Extract Job: {filename} {job.id} {status}"
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as log_file:
            log_file.write(log_line + "\n")

        if status != "COMPLETED":
            return filename, {
                "vendor_name": "",
                "invoice_number": "",
                "total_amount": 0,
                "line_items": [],
            }

        result = job.extract_result or {}
        return filename, result


async def main() -> None:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not api_key:
        raise RuntimeError("LLAMA_CLOUD_API_KEY is not set")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID is not set")

    client = AsyncLlamaCloud(api_key=api_key)
    semaphore = asyncio.Semaphore(3)

    tasks = [
        upload_and_extract(client, semaphore, filename, run_id)
        for filename in FILES
    ]
    results = await asyncio.gather(*tasks)

    output: Dict[str, Any] = {filename: data for filename, data in results}
    with RESULTS_PATH.open("w", encoding="utf-8") as results_file:
        json.dump(output, results_file, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
