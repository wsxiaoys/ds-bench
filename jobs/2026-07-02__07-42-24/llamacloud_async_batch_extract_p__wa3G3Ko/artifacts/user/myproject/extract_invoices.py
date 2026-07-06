import asyncio
import os
import json
from pydantic import BaseModel, Field
from typing import List
from llama_cloud import AsyncLlamaCloud, file_from_path

# Define the Pydantic schema for invoices
class InvoiceSchema(BaseModel):
    vendor_name: str = Field(description="The name of the vendor")
    invoice_number: str = Field(description="The unique invoice number")
    total_amount: float = Field(description="The total amount of the invoice")
    line_items: List[str] = Field(description="A list of line items on the invoice")

async def process_file(
    filename: str,
    semaphore: asyncio.Semaphore,
    client: AsyncLlamaCloud,
    run_id: str,
    results: dict,
    log_lock: asyncio.Lock
):
    async with semaphore:
        file_path = f"/home/user/myproject/data/{filename}"
        base_name, _ = os.path.splitext(filename)
        external_file_id = f"{base_name}-{run_id}"
        
        # Clean up any existing file with the same external_file_id
        paginator = await client.files.list(external_file_id=external_file_id)
        async for existing_file in paginator:
            print(f"Found existing file for {filename} with external_file_id {external_file_id} (ID: {existing_file.id}). Deleting...")
            try:
                await client.files.delete(existing_file.id)
                print(f"Deleted existing file ID: {existing_file.id}")
            except Exception as e:
                print(f"Warning: Failed to delete file {existing_file.id}: {e}")
        
        print(f"Uploading {filename} with external_file_id: {external_file_id}...")
        uploaded_file = await client.files.create(
            file=file_from_path(file_path),
            purpose="extract",
            external_file_id=external_file_id
        )
        file_id = uploaded_file.id
        print(f"Uploaded {filename}! File ID: {file_id}. Creating extract job...")
        
        job = await client.extract.create(
            file_input=file_id,
            configuration={
                "extraction_target": "per_doc",
                "tier": "cost_effective",
                "data_schema": InvoiceSchema.model_json_schema()
            }
        )
        job_id = job.id
        print(f"Created extract job for {filename}: {job_id}, status: {job.status}")
        
        # Poll the job status
        while True:
            job = await client.extract.get(job_id)
            if job.status == "COMPLETED":
                break
            elif job.status in ("FAILED", "CANCELLED"):
                raise Exception(f"Job {job_id} for {filename} failed with status: {job.status}. Error: {job.error_message}")
            await asyncio.sleep(2)
            
        print(f"Job {job_id} for {filename} completed successfully!")
        
        # Append to output log
        async with log_lock:
            with open("/home/user/myproject/output.log", "a") as log_file:
                log_file.write(f"Extract Job: {filename} {job_id} {job.status}\n")
                
        # Store result
        results[filename] = job.extract_result

async def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")
        
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
        
    client = AsyncLlamaCloud(api_key=api_key)
    
    filenames = ["invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf"]
    
    # Bound concurrency to at most 3 simultaneous in-flight extract jobs
    semaphore = asyncio.Semaphore(3)
    log_lock = asyncio.Lock()
    results = {}
    
    tasks = [
        process_file(filename, semaphore, client, run_id, results, log_lock)
        for filename in filenames
    ]
    
    await asyncio.gather(*tasks)
    
    # Persist the consolidated per-file results
    with open("/home/user/myproject/results.json", "w") as results_file:
        json.dump(results, results_file, indent=4)
        
    print("All jobs completed and results written to results.json!")

if __name__ == "__main__":
    asyncio.run(main())
