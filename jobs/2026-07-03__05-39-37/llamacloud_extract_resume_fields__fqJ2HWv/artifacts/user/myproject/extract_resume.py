"""Extract structured resume fields from a PDF using LlamaCloud Extract (v2 SDK)."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from pydantic import BaseModel, Field

from llama_cloud import LlamaCloud

# ---------------------------------------------------------------------------
# Paths and configuration
# ---------------------------------------------------------------------------
RESUME_PDF = Path("/home/user/myproject/resume.pdf")
RUN_ID_FILE = Path("/logs/artifacts/run-id")
OUTPUT_JSON = Path("/home/user/myproject/output.json")
OUTPUT_LOG = Path("/home/user/myproject/output.log")

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}
POLL_INTERVAL_SECONDS = 2.0


# ---------------------------------------------------------------------------
# Pydantic schema for the resume
# ---------------------------------------------------------------------------
class Resume(BaseModel):
    """Structured representation of a resume."""

    name: str = Field(description="The full name of the candidate.")
    email: str = Field(description="The email address of the candidate.")
    skills: list[str] = Field(
        description="A list of technical skills mentioned in the resume."
    )


def read_run_id() -> str:
    """Read the run-id from the artifacts file."""
    return RUN_ID_FILE.read_text().strip()


def wait_for_terminal_status(client: LlamaCloud, job_id: str):
    """Poll the extract job until it reaches a terminal status."""
    while True:
        job = client.extract.get(job_id)
        if job.status in TERMINAL_STATUSES:
            return job
        time.sleep(POLL_INTERVAL_SECONDS)


def main() -> None:
    # 1. Read the run-id for isolating file uploads across concurrent runs.
    run_id = read_run_id()
    external_file_id = f"harbor-resume-{run_id}"

    # 2. Build the client (api key is inferred from LLAMA_CLOUD_API_KEY env var).
    client = LlamaCloud()

    # 3. Upload the resume PDF for extraction.
    print(f"Uploading {RESUME_PDF} with external_file_id={external_file_id} ...")
    file_response = client.files.create(
        file=str(RESUME_PDF),
        purpose="extract",
        external_file_id=external_file_id,
    )
    file_id = file_response.id
    print(f"Uploaded file id: {file_id}")

    # 4. Derive the JSON schema from the Pydantic model and create an extract job.
    data_schema = Resume.model_json_schema()

    print("Creating extract job (tier=agentic, extraction_target=per_doc) ...")
    job = client.extract.create(
        file_input=file_id,
        configuration={
            "data_schema": data_schema,
            "extraction_target": "per_doc",
            "tier": "agentic",
        },
    )
    job_id = job.id
    print(f"Created extract job id: {job_id}")

    # 5. Wait for the job to reach a terminal status.
    print("Waiting for job to reach a terminal status ...")
    completed_job = wait_for_terminal_status(client, job_id)
    print(f"Job status: {completed_job.status}")

    # 6. Persist results on completion.
    if completed_job.status == "COMPLETED":
        extract_result = completed_job.extract_result
        print("Extraction completed. Writing output.json ...")
        with open(OUTPUT_JSON, "w") as fp:
            json.dump(extract_result, fp, indent=2)
    else:
        print(
            f"Job did not complete successfully (status={completed_job.status}). "
            f"Error: {completed_job.error_message}"
        )

    # 7. Append the job id to the log file (always, per requirements).
    with open(OUTPUT_LOG, "a") as fp:
        fp.write(f"Job ID: {job_id}\n")
    print(f"Appended 'Job ID: {job_id}' to {OUTPUT_LOG}")


if __name__ == "__main__":
    main()