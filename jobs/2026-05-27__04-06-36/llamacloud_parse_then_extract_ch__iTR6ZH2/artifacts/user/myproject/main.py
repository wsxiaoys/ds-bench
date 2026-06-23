import os
import json
import uuid
from pydantic import BaseModel
from typing import List
from llama_cloud import LlamaCloud

class InvoiceSchema(BaseModel):
    vendor: str
    invoice_number: str
    total_amount: float
    line_items: List[str]

def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    
    client = LlamaCloud(api_key=api_key)
    
    print("Uploading file...")
    with open("data/invoice.pdf", "rb") as f:
        uploaded_file = client.files.create(
            file=f,
            purpose="parse",
            external_file_id=f"invoice-{uuid.uuid4()}-{run_id}"
        )
    
    file_id = uploaded_file.id
    print(f"Uploaded file ID: {file_id}")
    
    print("Creating parse job...")
    parse_job = client.parsing.create(
        file_id=file_id,
        tier="agentic",
        version="latest"
    )
    
    parse_job_id = parse_job.id
    print(f"Parse Job ID: {parse_job_id}")
    
    print("Waiting for parse job to complete...")
    client.parsing.wait_for_completion(parse_job_id)
    
    print("Fetching parse job result...")
    parse_result = client.parsing.get(parse_job_id, expand=["markdown"])
    
    if parse_result.markdown and parse_result.markdown.pages:
        first_page_md = parse_result.markdown.pages[0].markdown
        with open("parsed.md", "w", encoding="utf-8") as f:
            f.write(first_page_md)
        print("Saved parsed.md")
    else:
        print("No markdown pages found in parse result")
    
    print("Creating extract job...")
    schema = InvoiceSchema.model_json_schema()
    
    extract_job = client.extract.create(
        file_input=parse_job_id,
        configuration={
            "data_schema": schema
        }
    )
    
    extract_job_id = extract_job.id
    print(f"Extract Job ID: {extract_job_id}")
    
    print("Waiting for extract job to complete...")
    completed_extract_job = client.extract.wait_for_completion(extract_job_id)
    
    extract_result = completed_extract_job.extract_result
    with open("extracted.json", "w", encoding="utf-8") as f:
        json.dump(extract_result, f, indent=2)
    print("Saved extracted.json")
    
    with open("output.log", "a", encoding="utf-8") as f:
        f.write(f"Parse Job ID: {parse_job_id}\n")
        f.write(f"Extract Job ID: {extract_job_id}\n")
    print("Saved output.log")

if __name__ == "__main__":
    main()
