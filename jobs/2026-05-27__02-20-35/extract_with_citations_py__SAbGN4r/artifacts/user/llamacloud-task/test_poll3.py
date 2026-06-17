import json
import time
from llama_cloud import LlamaCloud

client = LlamaCloud()
schema = {
    "type": "object",
    "properties": {
        "company_name": {"type": "string"}
    },
    "required": ["company_name"]
}

job = client.extract.create(
    file_input="f00d3b48-e6af-4ae9-ae0b-90dc99c6fe97",
    configuration={
        "data_schema": schema,
        "extraction_target": "per_doc",
        "tier": "agentic",
        "cite_sources": True,
        "parse_tier": "agentic"
    }
)
print("Job ID:", job.id)

while True:
    job = client.extract.get(job.id)
    if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
        break
    time.sleep(2)

print("extract_metadata:", job.extract_metadata)
