#!/usr/bin/env python3
"""
LlamaExtract v2: Auto-generate schema from prompt + sample PDF, then run extraction.
"""

import json
import os
import time

from llama_cloud import LlamaCloud

# ── Configuration ──────────────────────────────────────────────────────────────
API_KEY   = os.environ["LLAMA_CLOUD_API_KEY"]
RUN_ID    = os.environ["ZEALT_RUN_ID"]
PDF_PATH  = "/home/user/extract_task/data/invoice.pdf"
SCHEMA_FILE = "/home/user/extract_task/schema.json"
RESULT_FILE = "/home/user/extract_task/result.json"
LOG_FILE    = "/home/user/extract_task/output.log"

EXTERNAL_FILE_ID = f"invoice-{RUN_ID}.pdf"

client = LlamaCloud(api_key=API_KEY)

# ── Step 1: Upload the invoice PDF (or reuse existing by external_file_id) ─────
print(f"[1] Uploading {PDF_PATH} with external_file_id={EXTERNAL_FILE_ID} …")
file_id = None

# Try to find an existing file with this external_file_id first
existing_files = client.files.list()
for f in existing_files:
    if getattr(f, "external_file_id", None) == EXTERNAL_FILE_ID:
        file_id = f.id
        print(f"    Reusing existing file_id = {file_id}")
        break

if file_id is None:
    with open(PDF_PATH, "rb") as fh:
        file_resp = client.files.create(
            file=(EXTERNAL_FILE_ID, fh, "application/pdf"),
            purpose="extract",
            external_file_id=EXTERNAL_FILE_ID,
        )
    file_id = file_resp.id
    print(f"    Uploaded new file_id = {file_id}")

# ── Step 2: Auto-generate a JSON Schema for invoice data ───────────────────────
INVOICE_PROMPT = (
    "Extract structured invoice data including: invoice number, invoice date, "
    "due date, vendor/supplier name and address, buyer/bill-to name and address, "
    "line items (description, quantity, unit price, amount), subtotal, tax, "
    "total amount due, and payment terms."
)

print("[2] Generating schema from prompt + sample document …")
generated = client.extract.generate_schema(
    prompt=INVOICE_PROMPT,
    file_id=file_id,
)
print(f"    Schema name: {generated.name}")

# Retrieve the data_schema from the generated configuration's parameters
data_schema = generated.parameters.data_schema
print(f"    Top-level properties: {list(data_schema.get('properties', {}).keys())}")

# Save schema to disk
with open(SCHEMA_FILE, "w") as fh:
    json.dump(data_schema, fh, indent=2)
print(f"    Saved schema → {SCHEMA_FILE}")

# ── Step 3: Run extraction using the generated schema ─────────────────────────
print("[3] Submitting extraction job …")
job = client.extract.run(
    file_input=file_id,
    configuration={
        "data_schema": data_schema,
        "extraction_target": "per_doc",
        "tier": "agentic",
    },
    verbose=True,
)

job_id = job.id
job_status = job.status
print(f"    job_id = {job_id}  status = {job_status}")

# ── Step 4: Poll until terminal state ─────────────────────────────────────────
TERMINAL = {"COMPLETED", "FAILED", "CANCELLED"}
if job_status not in TERMINAL:
    print("[4] Polling for completion …")
    poll_interval = 5
    max_wait = 600  # 10 minutes
    elapsed = 0
    while job_status not in TERMINAL and elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval
        job = client.extract.get(job_id)
        job_status = job.status
        print(f"    [{elapsed}s] status = {job_status}")
        poll_interval = min(poll_interval + 2, 30)

print(f"[4] Final status: {job_status}")

# ── Step 5: Save extraction result ────────────────────────────────────────────
extract_result = job.extract_result
if extract_result is None:
    extract_result = {}

with open(RESULT_FILE, "w") as fh:
    json.dump(extract_result, fh, indent=2)
print(f"    Saved result → {RESULT_FILE}")

# ── Step 6: Write log file ────────────────────────────────────────────────────
schema_fields = ", ".join(data_schema.get("properties", {}).keys())
log_lines = [
    f"Schema fields: {schema_fields}",
    f"Job ID: {job_id}",
    f"Status: {job_status}",
]

with open(LOG_FILE, "w") as fh:
    fh.write("\n".join(log_lines) + "\n")

print(f"    Saved log → {LOG_FILE}")
print("\nDone!")
