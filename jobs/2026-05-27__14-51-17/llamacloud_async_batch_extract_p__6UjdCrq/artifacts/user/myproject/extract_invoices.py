import asyncio
import json
import os
from pathlib import Path
from typing import List

from pydantic import BaseModel
from llama_cloud import AsyncLlamaCloud


# Pydantic schema for invoices
class Invoice(BaseModel):
    vendor_name: str
    invoice_number: str
    total_amount: float
    line_items: List[str]


async def process_file(
    async_client: AsyncLlamaCloud,
    file_path: Path,
    semaphore: asyncio.Semaphore,
    run_id: str,
    results: dict,
    log_file: Path,
):
    """Process a single file: upload, extract, and persist results."""
    filename = file_path.name
    
    async with semaphore:
        # Upload file with purpose="extract" and external_file_id with run-id suffix
        external_file_id = f"{filename.stem}-{run_id}"
        
        uploaded_file = await async_client.files.create(
            file_path=str(file_path),
            purpose="extract",
            external_file_id=external_file_id,
        )
        
        # Create extract job
        data_schema = Invoice.model_json_schema()
        
        job = await async_client.extract.create(
            file_input=uploaded_file.id,
            extraction_target="per_doc",
            tier="cost_effective",
            configuration={
                "data_schema": data_schema,
            },
        )
        
        job_id = job.id
        
        # Poll for completion
        while job.status not in ["COMPLETED", "FAILED", "CANCELLED"]:
            await asyncio.sleep(2)  # Wait 2 seconds between polls
            job = await async_client.extract.get(job_id)
        
        # Persist result
        if job.status == "COMPLETED" and job.extract_result:
            results[filename] = job.extract_result
        else:
            results[filename] = {
                "error": f"Job {job_id} finished with status {job.status}",
                "vendor_name": None,
                "invoice_number": None,
                "total_amount": None,
                "line_items": [],
            }
        
        # Append to log file
        log_line = f"Extract Job: {filename} {job_id} {job.status}\n"
        with open(log_file, "a") as f:
            f.write(log_line)
        
        return job_id, job.status


async def main():
    # Read environment variables
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")
    
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID environment variable is not set")
    
    # Initialize async client
    async_client = AsyncLlamaCloud(api_key=api_key)
    
    # Get data directory
    data_dir = Path("/home/user/myproject/data")
    pdf_files = sorted(data_dir.glob("*.pdf"))
    
    if len(pdf_files) != 3:
        raise ValueError(f"Expected 3 PDF files, found {len(pdf_files)}")
    
    # Create semaphore to bound concurrency to 3
    semaphore = asyncio.Semaphore(3)
    
    # Results dictionary
    results = {}
    
    # Log file path
    log_file = Path("/home/user/myproject/output.log")
    
    # Create tasks for all files
    tasks = [
        process_file(
            async_client=async_client,
            file_path=file_path,
            semaphore=semaphore,
            run_id=run_id,
            results=results,
            log_file=log_file,
        )
        for file_path in pdf_files
    ]
    
    # Run all tasks concurrently
    await asyncio.gather(*tasks)
    
    # Write results to JSON file
    results_file = Path("/home/user/myproject/results.json")
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"Processing complete. Results saved to {results_file}")
    print(f"Log entries written to {log_file}")


if __name__ == "__main__":
    asyncio.run(main())