import os
import json
import time
from llama_cloud import LlamaCloud

def main():
    client = LlamaCloud()
    
    with open("/home/user/llamacloud-task/sample_invoice.txt", "rb") as f:
        file_obj = client.files.create(
            file=f,
            purpose="extract",
            external_file_id="test-invoice.txt"
        )
        
    print(f"File uploaded: {file_obj.id}")
    
    schema = {
        "type": "object",
        "properties": {
            "company_name": {"type": "string"},
            "invoice_number": {"type": "string"},
            "total_amount": {"type": "number"}
        },
        "required": ["company_name", "invoice_number", "total_amount"]
    }
    
    job = client.extract.create(
        file_input=file_obj.id,
        configuration={
            "data_schema": schema,
            "extraction_target": "per_doc",
            "tier": "agentic",
            "cite_sources": True
        }
    )
    
    print(f"Job created: {job.id}")
    
    while True:
        job = client.extract.get(job.id)
        print(f"Status: {job.status}")
        if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
            break
        time.sleep(2)
        
    if job.status == "COMPLETED":
        result = job.model_dump()
        with open("test_result.json", "w") as f:
            json.dump(result, f, indent=2)
            
if __name__ == "__main__":
    main()
