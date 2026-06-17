#!/usr/bin/env python3
"""
Extract structured resume fields using LlamaCloud Extract (v2 SDK).
"""

import os
import json
from pathlib import Path

from llama_cloud import LlamaCloud
from pydantic import BaseModel, Field


def main():
    # Read environment variables
    api_key = os.environ["LLAMA_CLOUD_API_KEY"]
    run_id = os.environ["ZEALT_RUN_ID"]

    # Initialize LlamaCloud client
    client = LlamaCloud(api_key=api_key)

    # Upload resume PDF or get existing file
    resume_path = Path("/home/user/myproject/resume.pdf")
    external_file_id = f"harbor-resume-{run_id}"

    # Try to get existing file by external_file_id
    existing_files = list(client.files.list(external_file_id=external_file_id))
    if existing_files:
        uploaded_file = existing_files[0]
    else:
        uploaded_file = client.files.create(
            file=resume_path,
            purpose="extract",
            external_file_id=external_file_id
        )

    # Define Pydantic model for resume extraction
    class Resume(BaseModel):
        name: str = Field(description="The full name of the candidate")
        email: str = Field(description="The email address of the candidate")
        skills: list[str] = Field(description="A list of technical skills possessed by the candidate")

    # Get JSON schema from Pydantic model
    data_schema = Resume.model_json_schema()

    # Create Extract job
    job = client.extract.create(
        file_input=uploaded_file.id,
        configuration={
            "data_schema": data_schema,
            "extraction_target": "per_doc",
            "tier": "agentic"
        }
    )

    # Wait for job to complete
    job = client.extract.wait_for_completion(job.id)

    # Check job status
    if job.status == "COMPLETED":
        # Write extract result to output.json
        with open("/home/user/myproject/output.json", "w") as fp:
            json.dump(job.extract_result, fp, indent=2)
    else:
        raise RuntimeError(f"Extract job failed with status: {job.status}")

    # Append job ID to output.log
    with open("/home/user/myproject/output.log", "a") as fp:
        fp.write(f"Job ID: {job.id}\n")


if __name__ == "__main__":
    main()