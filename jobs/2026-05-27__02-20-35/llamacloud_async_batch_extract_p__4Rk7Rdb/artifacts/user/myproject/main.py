import os
import json
import asyncio
from typing import List
from pydantic import BaseModel
from llama_cloud import AsyncLlamaCloud

class InvoiceSchema(BaseModel):
    vendor_name: str
    invoice_number: str
    total_amount: float
    line_items: List[str]

async def process_file(
    filename: str, 
    filepath: str, 
    client: AsyncLlamaCloud, 
    semaphore: asyncio.Semaphore, 
    run_id: str, 
    results: dict, 
    log_file: str
):
    async with semaphore:
        # 1. Upload file
        # Requirement: e.g. invoice_a-<run-id>
        name_without_ext = os.path.splitext(filename)[0]
        external_file_id = f"{name_without_ext}-{run_id}"
        
        with open(filepath, "rb") as f:
            uploaded_file = await client.files.create(
                file=(filename, f),
                purpose="extract",
                external_file_id=external_file_id
            )
        
        # 2. Create extract job
        job = await client.extract.create(
            file_input=uploaded_file.id,
            configuration={
                "extraction_target": "per_doc",
                "tier": "cost_effective",
                "data_schema": InvoiceSchema.model_json_schema()
            }
        )
        
        # 3. Poll for completion
        while True:
            job_status = await client.extract.get(job.id)
            if job_status.status in ["COMPLETED", "FAILED", "CANCELLED"]:
                break
            await asyncio.sleep(2)
            
        # 4. Save result and log
        with open(log_file, "a") as f:
            f.write(f"Extract Job: {filename} {job_status.id} {job_status.status}\n")
            
        if job_status.status == "COMPLETED" and job_status.extract_result:
            results[filename] = job_status.extract_result

async def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    
    client = AsyncLlamaCloud(api_key=api_key)
    semaphore = asyncio.Semaphore(3)
    
    data_dir = "/home/user/myproject/data"
    log_file = "/home/user/myproject/output.log"
    results_file = "/home/user/myproject/results.json"
    
    filenames = ["invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf"]
    results = {}
    
    tasks = []
    for filename in filenames:
        filepath = os.path.join(data_dir, filename)
        tasks.append(
            process_file(filename, filepath, client, semaphore, run_id, results, log_file)
        )
        
    await asyncio.gather(*tasks)
    
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
