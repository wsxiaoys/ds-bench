import json
import os
import time
from pathlib import Path

from llama_cloud import LlamaCloud

BASE = Path("/home/user/extract_task")
PDF_PATH = BASE / "data" / "invoice.pdf"
SCHEMA_OUT = BASE / "schema.json"
RESULT_OUT = BASE / "result.json"
LOG_OUT = BASE / "output.log"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

# 1) Read run-id
run_id = RUN_ID_PATH.read_text().strip()
external_file_id = f"invoice-{run_id}.pdf"
print(f"run-id: {run_id!r}")
print(f"external_file_id: {external_file_id!r}")

PROMPT = (
    "Extract data from this invoice. Include the invoice number, the vendor / seller "
    "(name and address), line items, subtotal, taxes, total amount due, and invoice date."
)

# 2) Create client (auth via LLAMA_CLOUD_API_KEY env var)
client = LlamaCloud()

# 3) Upload PDF
print("Uploading PDF...")
with open(PDF_PATH, "rb") as f:
    uploaded = client.files.create(file=f, purpose="extract", external_file_id=external_file_id)
file_id = uploaded.id
print(f"Uploaded file_id: {file_id}")

# 4) Generate schema
print("Generating schema...")
gen = client.extract.generate_schema(prompt=PROMPT, file_id=file_id, name=f"Invoice schema {run_id}")
print(f"Generated config name: {gen.name}")
# parameters is a discriminated union; access the ExtractV2Parameters
params = gen.parameters
print(f"parameters type: {type(params).__name__}")
# get data_schema
data_schema = params.data_schema
print(f"Generated data_schema properties: {list(data_schema.get('properties', {}).keys())}")

# 5) Save schema
with open(SCHEMA_OUT, "w") as f:
    json.dump(data_schema, f, indent=2)
print(f"Schema saved to {SCHEMA_OUT}")

# 6) Run extraction
print("Starting extraction job...")
configuration = {
    "data_schema": data_schema,
    "extraction_target": "per_doc",
    "tier": "agentic",
}
job = client.extract.create(file_input=file_id, configuration=configuration)
job_id = job.id
print(f"Job ID: {job_id}")
print(f"Initial status: {job.status}")

# 7) Poll until terminal
terminal_statuses = {"COMPLETED", "FAILED", "CANCELLED"}
while job.status not in terminal_statuses:
    time.sleep(3)
    job = client.extract.get(job_id)
    print(f"Status: {job.status}")
print(f"Final status: {job.status}")

# 8) Save result
extract_result = job.extract_result
print(f"extract_result type: {type(extract_result).__name__}")
if extract_result is None:
    print("WARNING: extract_result is None")
    result_payload = {"warning": "no extract_result", "status": job.status}
else:
    if isinstance(extract_result, list) and len(extract_result) == 1:
        result_payload = extract_result[0]
    else:
        result_payload = extract_result

with open(RESULT_OUT, "w") as f:
    json.dump(result_payload, f, indent=2, default=str)
print(f"Result saved to {RESULT_OUT}")

# 9) Write log file with 3 required lines
property_names = list(data_schema.get("properties", {}).keys())
schema_line = f"Schema fields: {', '.join(property_names)}"
job_line = f"Job ID: {job_id}"
status_line = f"Status: {job.status}"

with open(LOG_OUT, "w") as f:
    f.write(schema_line + "\n")
    f.write(job_line + "\n")
    f.write(status_line + "\n")

print("--- output.log ---")
print(open(LOG_OUT).read())
print("DONE")
