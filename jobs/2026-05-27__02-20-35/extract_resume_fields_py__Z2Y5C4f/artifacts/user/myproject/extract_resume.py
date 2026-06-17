import json
import os
from pathlib import Path

from pydantic import BaseModel, Field
from llama_cloud import BadRequestError, LlamaCloud


class Resume(BaseModel):
    name: str = Field(description="Candidate's full name")
    email: str = Field(description="Candidate's email address")
    skills: list[str] = Field(description="List of technical skills")


def main() -> None:
    api_key = os.environ["LLAMA_CLOUD_API_KEY"]
    run_id = os.environ["ZEALT_RUN_ID"]

    client = LlamaCloud(api_key=api_key)

    resume_path = Path("/home/user/myproject/resume.pdf")
    external_file_id = f"harbor-resume-{run_id}"

    try:
        uploaded_file = client.files.create(
            file=resume_path,
            purpose="extract",
            external_file_id=external_file_id,
        )
    except BadRequestError:
        existing_files = list(client.files.list(external_file_id=external_file_id))
        if not existing_files:
            raise
        uploaded_file = existing_files[0]

    job = client.extract.create(
        file_input=uploaded_file.id,
        configuration={
            "data_schema": Resume.model_json_schema(),
            "extraction_target": "per_doc",
            "tier": "agentic",
        },
    )

    job = client.extract.wait_for_completion(job.id)

    if job.status == "COMPLETED":
        output_path = Path("/home/user/myproject/output.json")
        with output_path.open("w", encoding="utf-8") as output_file:
            json.dump(job.extract_result, output_file, indent=2)

    log_path = Path("/home/user/myproject/output.log")
    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(f"Job ID: {job.id}\n")


if __name__ == "__main__":
    main()
