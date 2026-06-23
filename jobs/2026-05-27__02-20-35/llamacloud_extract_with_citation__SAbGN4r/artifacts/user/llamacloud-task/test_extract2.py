import json
from llama_cloud import LlamaCloud

client = LlamaCloud()
job = client.extract.get("ext-f5d4xlzlegp3n6rshkbtz927uou6")
dumped = job.model_dump(mode="json")
print("Job keys:", dumped.keys())
print("extract_result type:", type(dumped.get("extract_result")))
print("extract_metadata:", json.dumps(dumped.get("extract_metadata"), indent=2))

result_data = {
    "data": dumped.get("extract_result"),
    "extract_metadata": dumped.get("extract_metadata")
}
with open("/home/user/llamacloud-task/test_result.json", "w") as f:
    json.dump(result_data, f, indent=2)
