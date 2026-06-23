import asyncio
import json
import os
from pathlib import Path
from typing import List, Dict, Any

from pydantic import BaseModel, Field
from llama_cloud import AsyncLlamaCloud

# Configuration
PROJECT_ROOT = Path("/home/user/myproject")
DATA_DIR = PROJECT_ROOT / "data"
RESULTS_FILE = PROJECT_ROOT / "results.json"
LOG_FILE = PROJECT_ROOT / "output.log"
CONCURRENCY_LIMIT = 3
POLL_INTERVAL = 5

# Environment variables
API_KEY = os.environ.get("LLAMA_CLOUD_API_KEY")
RUN_ID = os.environ.get("ZEALT_RUN_ID")

if not API_KEY:
    raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")
if not RUN_ID:
    raise ValueError("ZEALT_RUN_ID environment variable is not set")

# Pydantic Schema for Extraction
class InvoiceSchema(BaseModel):
    vendor_name: str = Field(description="The name of the vendor")
    invoice_number: str = Field(description="The invoice number")
    total_amount: float = Field(description="The total amount of the invoice")
    line_items: List[str] = Field(description="A list of line items in the invoice")

async def process_file(
    client: AsyncLlamaCloud, 
    file_path: Path, 
    semaphore: asyncio.Semaphore,
    data_schema: Dict[str, Any]
) -> Dict[str, Any]:
    filename = file_path.name
    external_file_id = f"{file_path.stem}-{RUN_ID}"
    
    async with semaphore:
        # 1. Upload the file (or get existing if already uploaded)
        try:
            with open(file_path, "rb") as f:
                file_record = await client.files.create(
                    file=f,
                    external_file_id=external_file_id,
                    purpose="extract"
                )
        except Exception as e:
            if "duplicate key value violates unique constraint" in str(e):
                # Try to find the existing file
                files_list = await client.files.list(external_file_id=external_file_id)
                async for file_item in files_list:
                    file_record = file_item
                    break
                else:
                    raise e
            else:
                raise e
        
        # 2. Create the extract job
        extract_job = await client.extract.create(
            file_input=file_record.id,
            configuration={
                "data_schema": data_schema,
                "extraction_target": "per_doc",
                "tier": "cost_effective"
            }
        )
        
        job_id = extract_job.id
        
        # 3. Poll for completion
        while True:
            job = await client.extract.get(job_id)
            status = job.status
            
            if status in ["COMPLETED", "FAILED", "CANCELLED"]:
                break
            
            await asyncio.sleep(POLL_INTERVAL)
        
        # 4. Log the result
        with open(LOG_FILE, "a") as log_f:
            log_f.write(f"Extract Job: {filename} {job_id} {status}\n")
        
        # 5. Return result if completed
        result = None
        if status == "COMPLETED":
            result = job.extract_result
            
        return filename, result

async def main():
    # Initialize LlamaCloud client
    client = AsyncLlamaCloud(api_key=API_KEY)
    semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
    data_schema = InvoiceSchema.model_json_schema()
    
    files_to_process = list(DATA_DIR.glob("invoice_*.pdf"))
    
    tasks = [
        process_file(client, file_path, semaphore, data_schema)
        for file_path in files_to_process
    ]
    
    results_list = await asyncio.gather(*tasks)
    
    # Consolidate results
    results_map = {filename: result for filename, result in results_list if result is not None}
    
    with open(RESULTS_FILE, "w") as f:
        json.dump(results_map, f, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
