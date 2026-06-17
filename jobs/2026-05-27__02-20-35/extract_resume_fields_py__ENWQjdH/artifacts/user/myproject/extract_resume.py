import json
import os
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field
from llama_cloud import LlamaCloud


class Resume(BaseModel):
    name: str = Field(description="The full name of the candidate")
    email: str = Field(description="The email address of the candidate")
    skills: List[str] = Field(description="A list of technical skills of the candidate")


def main():
    api_key = os.environ["LLAMA_CLOUD_API_KEY"]
    run_id = os.environ["ZEALT_RUN_ID"]
    external_file_id = f"harbor-resume-{run_id}"

    client = LlamaCloud(api_key=api_key)

    # Upload the resume PDF with purpose="extract"
    resume_path = Path(__file__).parent / "resume.pdf"
    print(f"Uploading {resume_path} with external_file_id={external_file_id} ...")
    with open(resume_path, "rb") as f:
        uploaded_file = client.files.create(
            file=(resume_path.name, f.read(), "application/pdf"),
            purpose="extract",
            external_file_id=external_file_id,
        )
    print(f"Uploaded file ID: {uploaded_file.id}")

    # Build JSON schema from the Pydantic model
    data_schema = Resume.model_json_schema()

    # Create the extract job
    print("Creating extract job ...")
    job = client.extract.create(
        file_input=uploaded_file.id,
        configuration={
            "data_schema": data_schema,
            "extraction_target": "per_doc",
            "tier": "agentic",
        },
    )
    print(f"Extract job created. Job ID: {job.id}")

    # Wait for the job to reach a terminal state
    print("Waiting for job to complete ...")
    completed_job = client.extract.wait_for_completion(job.id, verbose=True)
    print(f"Job status: {completed_job.status}")

    project_dir = Path(__file__).parent

    if completed_job.status == "COMPLETED":
        output_json_path = project_dir / "output.json"
        with open(output_json_path, "w") as fp:
            json.dump(completed_job.extract_result, fp, indent=2)
        print(f"Results written to {output_json_path}")
    else:
        print(f"Job did not complete successfully. Status: {completed_job.status}")

    # Append job ID line to output.log
    output_log_path = project_dir / "output.log"
    with open(output_log_path, "a") as log_fp:
        log_fp.write(f"Job ID: {job.id}\n")
    print(f"Job ID logged to {output_log_path}")


if __name__ == "__main__":
    main()
