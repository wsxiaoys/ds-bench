#!/usr/bin/env python3
"""
Auto-generate a LlamaExtract Schema and Run Extraction

This script:
1. Uploads an invoice PDF to LlamaCloud with a unique external_file_id
2. Auto-generates a JSON Schema for invoice data
3. Uses the generated schema to run structured extraction
4. Saves the schema, extraction result, and log files
"""

import os
import json
import time
from llama_cloud import LlamaCloud

def main():
    # Get environment variables
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")
    
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID environment variable is not set")
    
    # Initialize the LlamaCloud client
    client = LlamaCloud(api_key=api_key)
    
    # Define file paths
    pdf_path = "/home/user/extract_task/data/invoice.pdf"
    schema_path = "/home/user/extract_task/schema.json"
    result_path = "/home/user/extract_task/result.json"
    log_path = "/home/user/extract_task/output.log"
    
    # Upload the PDF file with unique external_file_id
    external_file_id = f"invoice-{run_id}.pdf"
    print(f"Uploading file with external_file_id: {external_file_id}")
    
    try:
        with open(pdf_path, "rb") as f:
            uploaded_file = client.files.create(
                file=f,
                purpose="extract",
                external_file_id=external_file_id
            )
        file_id = uploaded_file.id
        print(f"File uploaded successfully. File ID: {file_id}")
    except Exception as e:
        # File might already exist, try to find it
        print(f"Upload failed (file may already exist): {e}")
        print("Trying to find existing file...")
        
        # List files to find the one with matching external_file_id
        files = client.files.list()
        for file in files:
            if hasattr(file, 'external_file_id') and file.external_file_id == external_file_id:
                file_id = file.id
                print(f"Found existing file with ID: {file_id}")
                break
        else:
            # If not found, try with a different external_file_id
            timestamp = int(time.time())
            external_file_id = f"invoice-{run_id}-{timestamp}.pdf"
            print(f"Trying with new external_file_id: {external_file_id}")
            with open(pdf_path, "rb") as f:
                uploaded_file = client.files.create(
                    file=f,
                    purpose="extract",
                    external_file_id=external_file_id
                )
            file_id = uploaded_file.id
            print(f"File uploaded successfully. File ID: {file_id}")
    
    # Generate schema for invoice data
    print("Generating schema for invoice data...")
    generated_schema = client.extract.generate_schema(
        prompt="Extract structured invoice data including invoice number, vendor/supplier information, line items, dates, and total amounts",
        file_id=file_id
    )
    
    # Extract the schema from the response
    schema = generated_schema.parameters.data_schema
    
    # Save the generated schema to disk
    print(f"Saving generated schema to {schema_path}")
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    
    # Extract top-level property names from the schema
    if "properties" in schema:
        property_names = list(schema["properties"].keys())
    else:
        property_names = []
    
    print(f"Schema generated with {len(property_names)} properties")
    
    # Create extraction configuration using the generated schema
    print("Creating extraction job...")
    extraction_config = {
        "extraction_target": "per_doc",
        "tier": "agentic",
        "data_schema": schema
    }
    
    extraction_job = client.extract.create(
        configuration=extraction_config,
        file_input=file_id
    )
    
    job_id = extraction_job.id
    print(f"Extraction job created. Job ID: {job_id}")
    
    # Poll until the job reaches a terminal state
    print("Polling for job completion...")
    terminal_states = ["COMPLETED", "FAILED", "CANCELLED"]
    
    while True:
        job_status = client.extract.get(job_id)
        status = job_status.status
        
        print(f"Current status: {status}")
        
        if status in terminal_states:
            break
        
        time.sleep(2)  # Wait 2 seconds before polling again
    
    final_status = job_status.status
    print(f"Job finished with status: {final_status}")
    
    # Get the extraction result if job completed successfully
    if final_status == "COMPLETED":
        if hasattr(job_status, 'extract_result') and job_status.extract_result:
            extraction_result = job_status.extract_result
        else:
            # Try to get the result from the job's result field
            extraction_result = job_status.result
    else:
        extraction_result = {"error": f"Job failed with status: {final_status}"}
    
    # Save the extraction result to disk
    print(f"Saving extraction result to {result_path}")
    with open(result_path, "w") as f:
        json.dump(extraction_result, f, indent=2)
    
    # Write log file with required information
    print(f"Writing log file to {log_path}")
    with open(log_path, "w") as f:
        # Schema fields line
        f.write(f"Schema fields: {', '.join(property_names)}\n")
        # Job ID line
        f.write(f"Job ID: {job_id}\n")
        # Status line
        f.write(f"Status: {final_status}\n")
    
    print("Extraction process completed successfully!")
    print(f"Schema saved to: {schema_path}")
    print(f"Result saved to: {result_path}")
    print(f"Log saved to: {log_path}")
    
    # Verify the log file contents
    print("\nVerifying log file contents:")
    with open(log_path, "r") as f:
        for line in f:
            print(f"  {line.rstrip()}")

if __name__ == "__main__":
    main()