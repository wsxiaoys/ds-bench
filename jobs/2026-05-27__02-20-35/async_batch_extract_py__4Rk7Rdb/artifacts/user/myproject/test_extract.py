import os
import asyncio
from llama_cloud import AsyncLlamaCloud
from pydantic import BaseModel
from typing import List

class InvoiceSchema(BaseModel):
    vendor_name: str
    invoice_number: str
    total_amount: float
    line_items: List[str]

async def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    client = AsyncLlamaCloud(api_key=api_key)
    
    file_id = "fb693fa3-be8d-43c4-a65b-971e1820908b"
    job = await client.extract.create(
        file_input=file_id,
        configuration={
            "extraction_target": "per_doc",
            "tier": "cost_effective",
            "data_schema": InvoiceSchema.model_json_schema()
        }
    )
    print("Job ID:", job.id)
    
    while True:
        job_status = await client.extract.get(job.id)
        print("Status:", job_status.status)
        if job_status.status in ["COMPLETED", "FAILED", "CANCELLED"]:
            if job_status.status == "COMPLETED":
                print("Result:", job_status.extract_result)
            break
        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(main())
