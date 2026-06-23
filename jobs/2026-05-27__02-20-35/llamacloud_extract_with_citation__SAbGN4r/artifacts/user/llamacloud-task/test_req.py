import logging
import httpx
from llama_cloud import LlamaCloud

logging.basicConfig(level=logging.DEBUG)

client = LlamaCloud(http_client=httpx.Client(event_hooks={'request': [lambda r: print(r.read().decode())]}))

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
        "cite_sources": True
    }
)
