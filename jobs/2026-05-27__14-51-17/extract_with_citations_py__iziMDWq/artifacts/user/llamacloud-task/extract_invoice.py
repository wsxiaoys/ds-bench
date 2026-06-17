#!/usr/bin/env python3
"""
Extract structured invoice data with citations using LlamaCloud Extract v2.
"""

import os
import sys
import time
import json
from pathlib import Path

from llama_cloud import LlamaCloud
from pydantic import BaseModel, Field


def main():
    # Read run-id from environment variable
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    # Define the schema for invoice extraction
    class InvoiceSchema(BaseModel):
        company_name: str = Field(description="The name of the vendor or company issuing the invoice")
        invoice_number: str = Field(description="The invoice number or reference identifier")
        total_amount: float = Field(description="The total amount due on the invoice")

    # Initialize LlamaCloud client (reads LLAMA_CLOUD_API_KEY from environment)
    client = LlamaCloud()

    # Upload the invoice file
    invoice_path = "/home/user/llamacloud-task/sample_invoice.txt"
    external_file_id = f"invoice-{run_id}.txt"

    print(f"Checking for existing file with external_file_id: {external_file_id}")

    # Try to find an existing file with this external_id
    existing_files = list(client.files.list(external_file_id=external_file_id))
    file_id = None

    if existing_files and len(existing_files) > 0:
        file_id = existing_files[0].id
        print(f"Found existing file. File ID: {file_id}")
    else:
        # If no existing file found, upload a new one
        print(f"Uploading new file with external_file_id: {external_file_id}")
        file_response = client.files.create(
            file=invoice_path,
            purpose="extract",
            external_file_id=external_file_id,
        )
        file_id = file_response.id
        print(f"File uploaded successfully. File ID: {file_id}")

    # Create extraction job with citation enabled
    schema_json = InvoiceSchema.model_json_schema()

    extraction_config = {
        "extraction_target": "per_doc",
        "tier": "agentic",
        "cite_sources": True,
    }

    print("Creating extraction job...")
    job = client.extract.create(
        file_input=file_id,
        schema=schema_json,
        configuration=extraction_config,
    )

    job_id = job.id
    print(f"Extract job: {job_id}")

    # Poll for job completion
    print("Polling for job completion...")
    max_attempts = 300  # 5 minutes with 1-second intervals
    attempt = 0

    while attempt < max_attempts:
        job_status = client.extract.get(job_id)
        status = job_status.status

        print(f"Current status: {status}")

        if status in ("COMPLETED", "FAILED", "CANCELLED"):
            break

        time.sleep(1)
        attempt += 1

    status = job_status.status
    print(f"Status: {status}")

    # Check for terminal failure states
    if status in ("FAILED", "CANCELLED"):
        print(f"Error: Job ended with status {status}", file=sys.stderr)
        sys.exit(1)

    if status != "COMPLETED":
        print(f"Error: Job did not complete. Final status: {status}", file=sys.stderr)
        sys.exit(1)

    # Get the final job result
    final_job = client.extract.get(job_id)

    # Prepare the output data
    extract_result = final_job.extract_result

    # Build the result JSON structure
    result = {
        "data": {},
        "extract_metadata": {},
    }

    # Extract the data fields
    if extract_result and extract_result.data:
        result["data"] = extract_result.data

    # Extract the metadata including citations
    if extract_result and extract_result.extract_metadata:
        result["extract_metadata"] = extract_result.extract_metadata.model_dump(mode="json")

    # Write the result JSON
    result_path = "/home/user/llamacloud-task/result.json"
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Results written to {result_path}")

    # Write the log file
    log_path = "/home/user/llamacloud-task/output.log"
    with open(log_path, "w") as f:
        f.write(f"Extract job: {job_id}\n")
        f.write(f"Status: {status}\n")

    print(f"Log written to {log_path}")
    print("Extraction completed successfully!")

    sys.exit(0)


if __name__ == "__main__":
    main()