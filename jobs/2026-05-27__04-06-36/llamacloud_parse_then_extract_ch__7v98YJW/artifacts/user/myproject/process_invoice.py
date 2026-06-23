import os
import json
from pydantic import BaseModel, Field
from typing import List
from llama_cloud import LlamaCloud

def run_chain():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    project_path = "/home/user/myproject"
    file_path = os.path.join(project_path, "data/invoice.pdf")
    
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY is not set")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID is not set")

    client = LlamaCloud(api_key=api_key)

    # 1. Upload File
    print(f"Uploading {file_path}...")
    import time
    unique_external_id = f"invoice_{int(time.time())}_{run_id}"
    with open(file_path, "rb") as f:
        file_obj = client.files.create(
            file=f,
            purpose="parse",
            external_file_id=unique_external_id
        )
    
    file_id = file_obj.id
    print(f"File uploaded. ID: {file_id}")

    # 2. Run Parse Job
    print("Starting Parse Job...")
    parse_job = client.parsing.create(
        file_id=file_id,
        tier="agentic",
        version="latest"
    )
    
    print(f"Waiting for Parse Job {parse_job.id} to complete...")
    client.parsing.wait_for_completion(job_id=parse_job.id)
    
    # Get markdown
    result = client.parsing.get(job_id=parse_job.id, expand=["markdown"])
    if result.markdown and result.markdown.pages:
        with open(os.path.join(project_path, "parsed.md"), "w") as f:
            f.write(result.markdown.pages[0].markdown)
    
    # 3. Define Schema for Extraction
    class InvoiceSchema(BaseModel):
        vendor: str = Field(description="The name of the vendor")
        invoice_number: str = Field(description="The invoice number")
        total_amount: float = Field(description="The total amount of the invoice")
        line_items: List[str] = Field(description="A list of line items on the invoice")

    # 4. Run Extract Job using Parse Job ID
    print(f"Starting Extract Job using Parse Job ID: {parse_job.id}...")
    extract_job = client.extract.create(
        file_input=parse_job.id,
        configuration={
            "data_schema": InvoiceSchema.model_json_schema()
        }
    )
    
    print(f"Waiting for Extract Job {extract_job.id} to complete...")
    extract_job_result = client.extract.wait_for_completion(job_id=extract_job.id)
    
    # 5. Persist Extraction Result
    with open(os.path.join(project_path, "extracted.json"), "w") as f:
        json.dump(extract_job_result.extract_result, f, indent=2)
    
    # 6. Log results
    with open(os.path.join(project_path, "output.log"), "a") as f:
        f.write(f"Parse Job ID: {parse_job.id}\n")
        f.write(f"Extract Job ID: {extract_job.id}\n")

    print("Done!")

if __name__ == "__main__":
    run_chain()
