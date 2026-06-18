import json
import httpx
from llama_cloud import LlamaCloud

client = LlamaCloud(http_client=httpx.Client(event_hooks={'response': [lambda r: print("RESPONSE:", r.read().decode())]}))
job = client.extract.get("ext-f5d4xlzlegp3n6rshkbtz927uou6")
