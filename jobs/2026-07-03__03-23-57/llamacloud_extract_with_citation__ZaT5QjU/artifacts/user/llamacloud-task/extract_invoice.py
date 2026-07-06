import os
import sys
import time
import json
from pydantic import BaseModel, Field
from llama_cloud import LlamaCloud

def main():
    # 1. Read run-id from /logs/artifacts/run-id
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: run-id file not found at {run_id_path}", file=sys.stderr)
        sys.exit(1)
        
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
        
    if not run_id:
        print("Error: run-id is empty", file=sys.stderr)
        sys.exit(1)
        
    print(f"Read run-id: {run_id}")

    # 2. Initialize LlamaCloud client
    # LLAMA_CLOUD_API_KEY is read from environment REDACTEDmatically
    client = LlamaCloud()

    # 3. Upload sample_invoice.txt
    invoice_path = "/home/user/llamacloud-task/sample_invoice.txt"
    if not os.path.exists(invoice_path):
        print(f"Error: sample_invoice.txt not found at {invoice_path}", file=sys.stderr)
        sys.exit(1)

    external_file_id = f"invoice-{run_id}.txt"
    print(f"Checking if file with external_file_id '{external_file_id}' already exists...")
    existing_files = list(client.files.list(external_file_id=external_file_id))
    if existing_files:
        file_record = existing_files[0]
        print(f"File already exists. Reusing ID: {file_record.id}")
    else:
        print(f"Uploading {invoice_path} as external_file_id: {external_file_id}...")
        with open(invoice_path, "rb") as f:
            file_record = client.files.create(
                file=f,
                purpose="extract",
                external_file_id=external_file_id
            )
        print(f"File uploaded successfully. ID: {file_record.id}")

    # 4. Define schema for extraction
    # The invoice must contain company_name, invoice_number, total_amount
    class InvoiceSchema(BaseModel):
        company_name: str = Field(description="The name of the vendor/company issuing the invoice")
        invoice_number: str = Field(description="The invoice number")
        total_amount: float = Field(description="The total amount due on the invoice")

    data_schema = InvoiceSchema.model_json_schema()
    print("Schema defined:")
    print(json.dumps(data_schema, indent=2))

    # 5. Create extraction job
    print("Creating extraction job...")
    job = client.extract.create(
        file_input=file_record.id,
        configuration={
            "data_schema": data_schema,
            "extraction_target": "per_doc",
            "tier": "agentic",
            "cite_sources": True
        }
    )
    job_id = job.id
    print(f"Extraction job created. ID: {job_id}")

    # 6. Poll until job reaches terminal status
    print("Polling job status...")
    while True:
        job = client.extract.get(job_id, expand=["extract_metadata"])
        print(f"Job status: {job.status}")
        if job.status in ("COMPLETED", "FAILED", "CANCELLED"):
            break
        time.sleep(5)

    if job.status in ("FAILED", "CANCELLED"):
        print(f"Job failed or cancelled with status: {job.status}", file=sys.stderr)
        if job.error_message:
            print(f"Error message: {job.error_message}", file=sys.stderr)
        sys.exit(1)

    print("Job completed successfully!")

    # Dump the full job model to inspect its structure
    job_dump = job.model_dump(mode="json")
    print("Full job dump:")
    print(json.dumps(job_dump, indent=2))

    # 7. Extract the required data and citations
    # The output result.json must contain:
    # - data: keys company_name, invoice_number, total_amount
    # - extract_metadata: field_metadata containing entries for those keys,
    #   and each entry must contain a non-empty citation array of {page, matching_text}
    
    extracted_data = job_dump.get("extract_result") or {}
    print(f"Extracted data: {extracted_data}")

    # Let's find field_metadata. The schema could nest it inside document_metadata or directly under field_metadata.
    # Let's write a robust parser to find the citations for our fields.
    job_extract_metadata = job_dump.get("extract_metadata") or {}
    job_field_metadata = job_extract_metadata.get("field_metadata") or {}
    
    # Let's inspect job_field_metadata. It might contain document_metadata.
    document_metadata = job_field_metadata.get("document_metadata") or {}
    
    # Let's construct the output field_metadata dictionary for result.json
    output_field_metadata = {}
    
    for field in ["company_name", "invoice_number", "total_amount"]:
        # Try to find citation in job_field_metadata[field] or document_metadata[field]
        field_meta = job_field_metadata.get(field) or document_metadata.get(field) or {}
        citation = field_meta.get("citation") or []
        
        # Ensure citation has page and matching_text keys
        cleaned_citation = []
        for cit in citation:
            page = cit.get("page")
            matching_text = cit.get("matching_text") or cit.get("text") or ""
            cleaned_citation.append({
                "page": page,
                "matching_text": matching_text
            })
            
        output_field_metadata[field] = {
            "citation": cleaned_citation
        }

    result_json = {
        "data": {
            "company_name": extracted_data.get("company_name"),
            "invoice_number": extracted_data.get("invoice_number"),
            "total_amount": extracted_data.get("total_amount")
        },
        "extract_metadata": {
            "field_metadata": output_field_metadata
        }
    }

    # 8. Write output.log
    output_log_path = "/home/user/llamacloud-task/output.log"
    print(f"Writing log to {output_log_path}...")
    with open(output_log_path, "w") as f:
        f.write(f"Extract job: {job_id}\n")
        f.write(f"Status: COMPLETED\n")

    # 9. Write result.json
    result_json_path = "/home/user/llamacloud-task/result.json"
    print(f"Writing result to {result_json_path}...")
    with open(result_json_path, "w") as f:
        json.dump(result_json, f, indent=2)

    print("All tasks completed successfully!")

if __name__ == "__main__":
    main()
