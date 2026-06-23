import os
import time
import json
from llama_cloud import LlamaCloud
from llama_cloud.types import ExtractConfigurationParam

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    client = LlamaCloud()
    
    file_path = "/home/user/extract_task/data/invoice.pdf"
    external_file_id = f"invoice-{run_id}.pdf"
    
    with open(file_path, "rb") as f:
        uploaded_file = client.files.create(
            file=(os.path.basename(file_path), f),
            purpose="extract",
            external_file_id=external_file_id
        )
    
    prompt = "Extract invoice details such as invoice_number, vendor_name, and total_amount."
    schema_response = client.extract.generate_schema(
        prompt=prompt,
        file_id=uploaded_file.id
    )
    
    data_schema = schema_response.parameters.data_schema
    
    with open("/home/user/extract_task/schema.json", "w") as f:
        json.dump(data_schema, f, indent=2)
        
    schema_fields = list(data_schema.get("properties", {}).keys())
    
    config = ExtractConfigurationParam(
        data_schema=data_schema,
        extraction_target="per_doc",
        tier="agentic"
    )
    
    job = client.extract.create(
        file_input=uploaded_file.id,
        configuration=config
    )
    
    while True:
        job_status = client.extract.get(job.id)
        if job_status.status in ["COMPLETED", "FAILED", "CANCELLED"]:
            break
        time.sleep(2)
        
    if job_status.status == "COMPLETED":
        result_data = job_status.extract_result
    else:
        result_data = {}
        
    if hasattr(result_data, "model_dump"):
        result_dict = result_data.model_dump()
    else:
        result_dict = result_data
        
    with open("/home/user/extract_task/result.json", "w") as f:
        json.dump(result_dict, f, indent=2)
        
    with open("/home/user/extract_task/output.log", "w") as f:
        f.write(f"Schema fields: {','.join(schema_fields)}\n")
        f.write(f"Job ID: {job.id}\n")
        f.write(f"Status: {job_status.status}\n")

if __name__ == "__main__":
    main()
