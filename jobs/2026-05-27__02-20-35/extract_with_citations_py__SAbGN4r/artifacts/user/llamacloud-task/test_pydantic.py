import json
import time
from pydantic import BaseModel
from llama_cloud import LlamaCloud

client = LlamaCloud()

class Invoice(BaseModel):
    company_name: str
    invoice_number: str
    total_amount: float

job = client.extract.create(
    file_input="f00d3b48-e6af-4ae9-ae0b-90dc99c6fe97",
    configuration={
        "data_schema": Invoice.model_json_schema(),
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

print(json.dumps(job.model_dump(mode="json"), indent=2))
