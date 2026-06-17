import os
import json
import time
from llama_cloud import LlamaCloud

def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not api_key or not run_id:
        print("Missing environment variables.")
        return

    client = LlamaCloud(api_key=api_key)

    file_path = "/home/user/extract_task/data/invoice.pdf"
    external_file_id = f"invoice-{run_id}.pdf"

    print(f"Checking if file exists: {external_file_id}")
    files = client.files.list(external_file_id=external_file_id)
    if files.items:
        file = files.items[0]
        print(f"File already exists. ID: {file.id}")
    else:
        print(f"Uploading file: {file_path} as {external_file_id}")
        with open(file_path, "rb") as f:
            file = client.files.create(
                file=f,
                purpose="extract",
                external_file_id=external_file_id
            )
        print(f"File uploaded. ID: {file.id}")

    # Generate schema
    prompt = "Extract invoice details including invoice number, vendor name, and total amount."
    print(f"Generating schema for prompt: {prompt}")
    generated = client.extract.generate_schema(
        prompt=prompt,
        file_id=file.id
    )

    schema = generated.parameters.data_schema
    schema_path = "/home/user/extract_task/schema.json"
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"Schema saved to {schema_path}")

    # Run extraction
    print("Starting extraction job...")
    job = client.extract.create(
        file_input=file.id,
        configuration={
            "data_schema": schema,
            "extraction_target": "per_doc",
            "tier": "agentic"
        }
    )
    job_id = job.id
    print(f"Job created. ID: {job_id}")

    # Polling
    status = job.status
    while status not in ["COMPLETED", "FAILED", "CANCELLED"]:
        print(f"Current status: {status}. Waiting...")
        time.sleep(5)
        job = client.extract.get(job_id)
        status = job.status

    print(f"Terminal status reached: {status}")

    # Save result
    if status == "COMPLETED":
        result_path = "/home/user/extract_task/result.json"
        with open(result_path, "w") as f:
            json.dump(job.extract_result, f, indent=2)
        print(f"Result saved to {result_path}")
    else:
        print(f"Extraction failed with status: {status}")

    # Log file
    log_path = "/home/user/extract_task/output.log"
    with open(log_path, "w") as f:
        # Schema fields: <comma-separated property names>
        properties = schema.get("properties", {})
        fields_str = ", ".join(properties.keys())
        f.write(f"Schema fields: {fields_str}\n")
        # Job ID: <job_id>
        f.write(f"Job ID: {job_id}\n")
        # Status: COMPLETED
        f.write(f"Status: {status}\n")
    print(f"Log saved to {log_path}")

if __name__ == "__main__":
    main()
