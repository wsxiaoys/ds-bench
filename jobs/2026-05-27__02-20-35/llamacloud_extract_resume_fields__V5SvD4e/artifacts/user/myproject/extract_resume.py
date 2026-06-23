import os
import json
from pydantic import BaseModel, Field
from llama_cloud import LlamaCloud

class Resume(BaseModel):
    name: str = Field(description="Name of the candidate")
    email: str = Field(description="Email address of the candidate")
    skills: list[str] = Field(description="List of technical skills")

def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    
    if not api_key or not run_id:
        raise ValueError("LLAMA_CLOUD_API_KEY and ZEALT_RUN_ID must be set")
        
    client = LlamaCloud(api_key=api_key)
    
    external_file_id = f"harbor-resume-{run_id}"
    file_path = "/home/user/myproject/resume.pdf"
    
    # Upload file
    with open(file_path, "rb") as f:
        file_obj = client.files.create(
            file=f,
            purpose="extract",
            external_file_id=external_file_id
        )
        
    # Create Extract job
    job = client.extract.create(
        file_input=file_obj.id,
        configuration={
            "data_schema": Resume.model_json_schema(),
            "extraction_target": "per_doc",
            "tier": "agentic"
        }
    )
    
    # Wait for completion
    job = client.extract.wait_for_completion(job.id, verbose=True)
        
    if job.status == "COMPLETED":
        with open("/home/user/myproject/output.json", "w") as f:
            json.dump(job.extract_result, f, indent=2)
            
    with open("/home/user/myproject/output.log", "a") as f:
        f.write(f"Job ID: {job.id}\n")

if __name__ == "__main__":
    main()
