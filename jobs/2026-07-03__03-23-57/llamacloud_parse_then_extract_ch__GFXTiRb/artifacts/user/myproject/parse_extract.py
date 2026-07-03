import os
import json
from typing import List
from pydantic import BaseModel
from llama_cloud import LlamaCloud, file_from_path

class Invoice(BaseModel):
    vendor: str
    invoice_number: str
    total_amount: float
    line_items: List[str]

def main():
    # 1. Read API Key
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set.")
    
    # 2. Read run-id
    run_id_path = "/logs/artifacts/run-id"
    if os.path.exists(run_id_path):
        with open(run_id_path, "r") as f:
            run_id = f.read().strip()
    else:
        run_id = "default_run_id"
    
    print(f"Using run-id: {run_id}")
    
    # Initialize LlamaCloud client
    client = LlamaCloud(api_key=api_key)
    
    # 3. Upload file
    file_path = "/home/user/myproject/data/invoice.pdf"
    external_file_id = f"invoice_{run_id}"
    
    print(f"Checking if file with external_file_id '{external_file_id}' already exists...")
    existing_files = list(client.files.list(external_file_id=external_file_id))
    if existing_files:
        uploaded_file = existing_files[0]
        print(f"Reusing existing file with ID: {uploaded_file.id}")
    else:
        print(f"Uploading {file_path}...")
        uploaded_file = client.files.create(
            file=file_from_path(file_path),
            purpose="parse",
            external_file_id=external_file_id
        )
        print(f"Uploaded file successfully. ID: {uploaded_file.id}")
        
    # 4. Run a Parse job
    print("Creating Parse job...")
    parse_job = client.parsing.create(
        file_id=uploaded_file.id,
        tier="agentic",
        version="latest"
    )
    parse_job_id = parse_job.id
    print(f"Parse Job ID: {parse_job_id}")
    
    # Wait for Parse job completion
    print("Waiting for Parse job completion...")
    client.parsing.wait_for_completion(parse_job_id, verbose=True)
    print("Parse job completed successfully.")
    
    # Retrieve Parse result
    parse_result = client.parsing.get(parse_job_id, expand=["markdown"])
    
    # Save the markdown of the first page to /home/user/myproject/parsed.md
    if parse_result.markdown and parse_result.markdown.pages:
        first_page_markdown = parse_result.markdown.pages[0].markdown
    else:
        first_page_markdown = ""
        print("Warning: No markdown content returned for the first page.")
        
    parsed_md_path = "/home/user/myproject/parsed.md"
    with open(parsed_md_path, "w", encoding="utf-8") as f:
        f.write(first_page_markdown)
    print(f"Saved first page markdown to {parsed_md_path}")
    
    # 5. Run Extract job using parse-job ID as the file_input
    print("Creating Extract job...")
    configuration = {
        "data_schema": Invoice.model_json_schema()
    }
    extract_job = client.extract.create(
        file_input=parse_job_id,
        configuration=configuration
    )
    extract_job_id = extract_job.id
    print(f"Extract Job ID: {extract_job_id}")
    
    # Wait for Extract job completion
    print("Waiting for Extract job completion...")
    completed_extract_job = client.extract.wait_for_completion(extract_job_id, verbose=True)
    print("Extract job completed successfully.")
    
    # Save the structured extraction result as JSON to /home/user/myproject/extracted.json
    extract_result = completed_extract_job.extract_result
    extracted_json_path = "/home/user/myproject/extracted.json"
    with open(extracted_json_path, "w", encoding="utf-8") as f:
        json.dump(extract_result, f, indent=2)
    print(f"Saved extracted JSON to {extracted_json_path}")
    
    # Format Job IDs if necessary
    formatted_parse_job_id = parse_job_id
    if not formatted_parse_job_id.startswith("pjb-"):
        formatted_parse_job_id = f"pjb-{formatted_parse_job_id}"
        
    formatted_extract_job_id = extract_job_id
    
    # 6. Append single-line summary for each job to /home/user/myproject/output.log
    output_log_path = "/home/user/myproject/output.log"
    with open(output_log_path, "a", encoding="utf-8") as f:
        f.write(f"Parse Job ID: {formatted_parse_job_id}\n")
        f.write(f"Extract Job ID: {formatted_extract_job_id}\n")
    print(f"Appended job summaries to {output_log_path}")

if __name__ == "__main__":
    main()
