import os
import json
import time
from llama_cloud import LlamaCloud

run_id = os.environ.get("ZEALT_RUN_ID", "local-test")
client = LlamaCloud()

with open("/home/user/llamacloud-task/sample_invoice.txt", "rb") as f:
    file_obj = client.files.create(
        file=f,
        purpose="extract",
        external_file_id=f"invoice-{run_id}.txt"
    )

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
print("Job ID:", job.id)

while True:
    job = client.extract.get(job.id)
    if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
        break
    time.sleep(2)

print("extract_metadata:", job.extract_metadata)
