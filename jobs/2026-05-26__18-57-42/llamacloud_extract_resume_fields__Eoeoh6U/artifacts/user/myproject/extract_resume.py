import os
import json
import time
from typing import List
from pydantic import BaseModel, Field
from llama_cloud import LlamaCloud

class Resume(BaseModel):
    name: str = Field(description="The full name of the candidate")
    email: str = Field(description="The email address of the candidate")
    skills: List[str] = Field(description="A list of technical skills mentioned in the resume")

def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY is not set")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID is not set")

    client = LlamaCloud(api_key=api_key)
    
    resume_path = "/home/user/myproject/resume.pdf"
    external_file_id = f"harbor-resume-{run_id}"
    
    print(f"Uploading {resume_path} with external_file_id={external_file_id}...")
    try:
        with open(resume_path, "rb") as f:
            file = client.files.create(
                file=f,
                purpose="extract",
                external_file_id=external_file_id
            )
    except Exception as e:
        if "already exists" in str(e):
            print("File already exists, retrieving...")
            files = client.files.list(external_file_id=external_file_id)
            # Find the file in the list
            file = None
            for f in files:
                if f.external_file_id == external_file_id:
                    file = f
                    break
            if not file:
                raise ValueError(f"File with external_file_id {external_file_id} not found after conflict")
        else:
            raise e
    
    print(f"File uploaded. ID: {file.id}")

    schema = Resume.model_json_schema()

    print("Creating extract job...")
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

    print("Waiting for job completion...")
    # Using wait_for_completion as suggested in hints
    job = client.extract.wait_for_completion(job_id)
    
    status = job.status
    print(f"Final status: {status}")

    if status == "COMPLETED":
        print("Job completed successfully.")
        with open("/home/user/myproject/output.json", "w") as f:
            json.dump(job.extract_result, f, indent=2)
        print("Results written to output.json")
    else:
        print(f"Job finished with status: {status}")
        if hasattr(job, 'error'):
            print(f"Error: {job.error}")

    with open("/home/user/myproject/output.log", "a") as f:
        f.write(f"Job ID: {job_id}\n")
    print("Job ID written to output.log")

if __name__ == "__main__":
    main()
