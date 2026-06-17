#!/usr/bin/env python3
"""
Parse-then-Extract Chain with LlamaCloud v2 SDK

This script demonstrates:
1. Uploading a PDF with purpose="parse"
2. Running a Parse job (agentic tier, latest version)
3. Reusing the parse-job ID as input to an Extract job
4. Saving both the parsed markdown and extracted structured data
"""

import os
import json
from typing import List, Optional

from pydantic import BaseModel, Field
from llama_cloud import LlamaCloud, file_from_path


# Pydantic schema for invoice extraction
class InvoiceSchema(BaseModel):
    """Schema for structured invoice data extraction"""
    vendor: str = Field(description="The name of the vendor or company issuing the invoice")
    invoice_number: str = Field(description="The invoice number or reference")
    total_amount: float = Field(description="The total amount due on the invoice")
    line_items: List[str] = Field(description="List of line items or services billed")


def main():
    # Initialize client with API key from environment
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")
    
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID environment variable is not set")
    
    client = LlamaCloud(api_key=api_key)
    
    # Path to the invoice PDF
    pdf_path = "data/invoice.pdf"
    
    # Create unique external_file_id using run-id
    external_file_id = f"invoice-{run_id}"
    
    print(f"Starting parse-then-extract chain for {pdf_path}")
    print(f"External file ID: {external_file_id}")
    
    # Step 1: Upload the PDF with purpose="parse"
    print("\n[1/4] Uploading PDF to LlamaCloud...")
    file_obj = file_from_path(pdf_path)
    uploaded_file = client.files.create(
        file=file_obj,
        purpose="parse",
        external_file_id=external_file_id
    )
    print(f"File uploaded successfully: {uploaded_file.id}")
    
    # Step 2: Run Parse job with agentic tier and latest version
    print("\n[2/4] Running Parse job (agentic tier, latest version)...")
    parse_job = client.parsing.create(
        file_id=uploaded_file.id,
        tier="agentic",
        version="latest"
    )
    
    # Wait for parse job to complete
    parse_job = client.parsing.wait_for_completion(parse_job.id)
    print(f"Parse job completed: {parse_job.id}")
    print(f"Parse job status: {parse_job.status}")
    
    if parse_job.status != "COMPLETED":
        raise RuntimeError(f"Parse job failed with status: {parse_job.status}")
    
    # Save first page markdown to parsed.md
    if parse_job.result and len(parse_job.result) > 0:
        first_page_markdown = parse_job.result[0].markdown
        with open("parsed.md", "w", encoding="utf-8") as f:
            f.write(first_page_markdown)
        print(f"Saved first page markdown to parsed.md")
    else:
        raise RuntimeError("Parse job returned no results")
    
    # Step 3: Reuse parse-job ID as file_input for Extract job
    print("\n[3/4] Running Extract job using parse-job ID as input...")
    
    # Get JSON schema from Pydantic model
    data_schema = InvoiceSchema.model_json_schema()
    
    extract_job = client.extract.create(
        file_input=parse_job.id,  # Reuse parse-job ID, not file ID
        configuration={
            "schema": data_schema
        }
    )
    
    # Wait for extract job to complete
    extract_job = client.extract.wait_for_completion(extract_job.id)
    print(f"Extract job completed: {extract_job.id}")
    print(f"Extract job status: {extract_job.status}")
    
    if extract_job.status != "COMPLETED":
        raise RuntimeError(f"Extract job failed with status: {extract_job.status}")
    
    # Verify that file_input equals parse job ID (proving chain pattern)
    if extract_job.file_input != parse_job.id:
        raise RuntimeError(
            f"Extract job file_input ({extract_job.file_input}) does not match "
            f"parse job ID ({parse_job.id}). Chain pattern not verified."
        )
    print(f"Verified: Extract job uses parse job ID as input")
    
    # Step 4: Save extraction result to extracted.json
    if extract_job.extract_result:
        # The extract_result is already JSON-serializable
        extracted_data = extract_job.extract_result
        with open("extracted.json", "w", encoding="utf-8") as f:
            json.dump(extracted_data, f, indent=2)
        print(f"Saved extraction result to extracted.json")
    else:
        raise RuntimeError("Extract job returned no results")
    
    # Append job IDs to output.log
    with open("output.log", "a", encoding="utf-8") as f:
        f.write(f"Parse Job ID: {parse_job.id}\n")
        f.write(f"Extract Job ID: {extract_job.id}\n")
    print(f"\n[4/4] Appended job IDs to output.log")
    
    print("\n✅ Parse-then-extract chain completed successfully!")
    print(f"Parse Job ID: {parse_job.id}")
    print(f"Extract Job ID: {extract_job.id}")


if __name__ == "__main__":
    main()