import os
import json
from llama_cloud import LlamaCloud

def main():
    # 1. Read run-id from /logs/artifacts/run-id
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
    print(f"Read run-id: {run_id}")

    # 2. Initialize LlamaCloud client
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set.")
    client = LlamaCloud(api_key=api_key)

    # 3. Clean up any existing file with the target external_file_id
    target_external_id = f"invoice-{run_id}.pdf"
    print(f"Checking for existing files with external_file_id: {target_external_id}")
    existing_files = list(client.files.list(external_file_id=target_external_id))
    for f in existing_files:
        print(f"Deleting existing file: {f.id}")
        client.files.delete(f.id)

    # 4. Upload PDF with external_file_id ending with -<run-id>.pdf
    pdf_path = "/home/user/extract_task/data/invoice.pdf"
    print(f"Uploading {pdf_path}...")
    with open(pdf_path, "rb") as f:
        file_record = client.files.create(
            file=f,
            purpose="extract",
            external_file_id=target_external_id
        )
    print(f"Uploaded file ID: {file_record.id}")

    # 5. Auto-generate JSON Schema for invoice data using client.extract.generate_schema
    prompt = "Generate a JSON schema for invoice data. It must include: 1. an invoice number or ID, 2. a vendor or supplier/seller/merchant, and 3. a total amount or summary/subtotal."
    print("Generating schema...")
    generated = client.extract.generate_schema(
        file_id=file_record.id,
        prompt=prompt
    )
    
    schema = generated.parameters.data_schema
    print("Schema generated successfully.")
    
    # Save schema to /home/user/extract_task/schema.json
    schema_path = "/home/user/extract_task/schema.json"
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"Saved schema to {schema_path}")

    # 6. Run structured extraction using the generated schema
    print("Starting extraction job...")
    job = client.extract.create(
        file_input=file_record.id,
        configuration={
            "data_schema": schema,
            "extraction_target": "per_doc",
            "tier": "agentic"
        }
    )
    print(f"Created extraction job ID: {job.id}")

    # Poll until the job reaches a terminal state (COMPLETED, FAILED, or CANCELLED)
    print("Waiting for job completion...")
    completed_job = client.extract.wait_for_completion(job.id, verbose=True)
    print(f"Job finished with status: {completed_job.status}")

    # Save extracted JSON to /home/user/extract_task/result.json
    result_path = "/home/user/extract_task/result.json"
    with open(result_path, "w") as f:
        json.dump(completed_job.extract_result, f, indent=2)
    print(f"Saved extraction result to {result_path}")

    # 7. Write log file to /home/user/extract_task/output.log
    # Schema fields: <comma-separated property names>
    # Job ID: <job_id>
    # Status: COMPLETED
    properties = schema.get("properties", {})
    schema_fields_str = ",".join(properties.keys())
    
    log_lines = [
        f"Schema fields: {schema_fields_str}",
        f"Job ID: {completed_job.id}",
        f"Status: {completed_job.status}"
    ]
    
    log_path = "/home/user/extract_task/output.log"
    with open(log_path, "w") as f:
        f.write("\n".join(log_lines) + "\n")
    print(f"Saved log file to {log_path}")

if __name__ == "__main__":
    main()
