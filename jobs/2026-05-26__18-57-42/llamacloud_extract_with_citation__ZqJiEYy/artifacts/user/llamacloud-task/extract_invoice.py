import os
import json
import time
import sys
from llama_cloud import LlamaCloud

def main():
    # 1. Setup environment and client
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run")
    
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY not set")
        sys.exit(1)

    client = LlamaCloud(api_key=api_key)

    project_dir = "/home/user/llamacloud-task"
    invoice_path = os.path.join(project_dir, "sample_invoice.txt")
    log_path = os.path.join(project_dir, "output.log")
    result_path = os.path.join(project_dir, "result.json")

    # 2. Upload file
    external_file_id = f"invoice-{run_id}.txt"
    print(f"Uploading file with external_file_id: {external_file_id}")
    
    try:
        with open(invoice_path, "rb") as f:
            file_obj = client.files.create(
                file=f,
                purpose="extract",
                external_file_id=external_file_id
            )
        file_id = file_obj.id
        print(f"File uploaded. ID: {file_id}")
    except Exception as e:
        if "already exists" in str(e):
            print("File already exists, searching for existing file...")
            files = client.files.list()
            # The SDK might return a list or an object with a data attribute
            file_list = files.data if hasattr(files, "data") else files
            file_id = None
            for f in file_list:
                if f.external_file_id == external_file_id:
                    file_id = f.id
                    break
            if not file_id:
                raise e
            print(f"Found existing file. ID: {file_id}")
        else:
            raise e

    # 3. Define Schema
    # Extract v2 uses JSON Schema for the schema field
    invoice_schema = {
        "type": "object",
        "properties": {
            "company_name": {"type": "string"},
            "invoice_number": {"type": "string"},
            "total_amount": {"type": "number"}
        },
        "required": ["company_name", "invoice_number", "total_amount"]
    }

    # 4. Create Extract Job
    print("Creating extract job...")
    extract_job = client.extract.create(
        file_input=file_id,
        configuration={
            "data_schema": invoice_schema,
            "extraction_target": "per_doc",
            "tier": "agentic",
            "cite_sources": True
        }
    )
    
    job_id = extract_job.id
    print(f"Extract job: {job_id}")

    # 5. Poll for completion
    status = "PENDING"
    while status not in ["COMPLETED", "FAILED", "CANCELLED"]:
        print(f"Polling job status: {status}...")
        time.sleep(5)
        job_status = client.extract.get(job_id)
        status = job_status.status

    print(f"Status: {status}")

    # Write to log file early to ensure it exists if failure happens
    with open(log_path, "w") as log_file:
        log_file.write(f"Extract job: {job_id}\n")
        log_file.write(f"Status: {status}\n")

    if status != "COMPLETED":
        print(f"Job failed with status: {status}")
        sys.exit(1)

    # 6. Retrieve Results
    # Use expand=["extract_metadata"] to get the citations
    job_result = client.extract.get(job_id, expand=["extract_metadata"])
    
    # In Extract v2, the result data is in job.extract_result
    # and metadata is in job.extract_metadata when expanded
    data = job_result.extract_result
    metadata = job_result.extract_metadata
    
    if hasattr(metadata, "model_dump"):
        metadata = metadata.model_dump(mode="json")
    elif not isinstance(metadata, dict) and metadata is not None:
        metadata = str(metadata)

    # The prompt requires:
    # "extract_metadata" is an object containing a "field_metadata" object. 
    # "field_metadata" must contain entries for the leaf fields above.
    
    # In the current response, they are inside "document_metadata".
    # Let's flatten it if necessary to meet the exact AC: 
    # "field_metadata must contain entries for the leaf fields above"
    
    if metadata and "field_metadata" in metadata:
        fm = metadata["field_metadata"]
        if "document_metadata" in fm and fm["document_metadata"]:
            for field, val in fm["document_metadata"].items():
                if field not in fm:
                    fm[field] = val
    
    output_data = {
        "data": data,
        "extract_metadata": metadata
    }

    with open(result_path, "w") as res_file:
        json.dump(output_data, res_file, indent=2)

    print("Success! Results written to result.json and output.log")

if __name__ == "__main__":
    main()
