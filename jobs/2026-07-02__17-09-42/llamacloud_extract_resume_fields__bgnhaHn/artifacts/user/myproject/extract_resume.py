"""Extract structured fields from a resume PDF using LlamaCloud Extract (v2 SDK).

This script:
  1. Reads the `LLAMA_CLOUD_API_KEY` from the environment.
  2. Reads the run identifier from `/logs/artifacts/run-id`.
  3. Uploads `resume.pdf` to LlamaCloud with `purpose="extract"` and an
     `external_file_id` of `harbor-resume-<run-id>` so file uploads are isolated
     across concurrent runs.
  4. Defines a `Resume` Pydantic schema and submits an extraction job using the
     `agentic` tier with `extraction_target="per_doc"`.
  5. Polls the job until it reaches a terminal state (`COMPLETED`, `FAILED`, or
     `CANCELLED`).
  6. On `COMPLETED`, writes `extract_result` to `output.json` (pretty-printed)
     and appends `Job ID: <job_id>` to `output.log`.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from llama_cloud import LlamaCloud
from pydantic import BaseModel, Field


RESUME_PDF_PATH = Path("/home/user/myproject/resume.pdf")
OUTPUT_JSON_PATH = Path("/home/user/myproject/output.json")
OUTPUT_LOG_PATH = Path("/home/user/myproject/output.log")
RUN_ID_FILE = Path("/logs/artifacts/run-id")

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}
POLL_INTERVAL_SECONDS = 2.0


class Resume(BaseModel):
    """Structured schema describing a candidate's resume."""

    name: str = Field(description="The candidate's full name as written on the resume.")
    email: str = Field(description="The candidate's email address.")
    skills: list[str] = Field(
        description="A list of technical skills mentioned on the resume.",
    )


def _read_run_id(path: Path) -> str:
    """Read and return the trimmed run identifier from the given file."""
    return path.read_text().strip()


def main() -> None:
    api_key = os.environ["LLAMA_CLOUD_API_KEY"]
    run_id = _read_run_id(RUN_ID_FILE)
    external_file_id = f"harbor-resume-{run_id}"

    client = LlamaCloud(api_key=api_key)

    # 1. Upload the resume PDF.
    uploaded = client.files.create(
        file=RESUME_PDF_PATH,
        purpose="extract",
        external_file_id=external_file_id,
    )
    print(f"Uploaded file id={uploaded.id} external_file_id={uploaded.external_file_id}")

    # 2. Submit the extraction job using the flattened v2 configuration dict.
    data_schema = Resume.model_json_schema()
    configuration = {
        "data_schema": data_schema,
        "extraction_target": "per_doc",
        "tier": "agentic",
    }

    job = client.extract.create(file_input=uploaded.id, configuration=configuration)
    job_id = job.id
    print(f"Created extract job id={job_id} status={job.status}")

    # Always record the job id in the log file (even if it later fails).
    OUTPUT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_LOG_PATH.open("a", encoding="utf-8") as log_fp:
        log_fp.write(f"Job ID: {job_id}\n")

    # 3. Poll until the job reaches a terminal state.
    while job.status not in TERMINAL_STATUSES:
        time.sleep(POLL_INTERVAL_SECONDS)
        job = client.extract.get(job_id)
        print(f"Polling job id={job_id} status={job.status}")

    # 4. Persist the extracted result if the job succeeded.
    if job.status == "COMPLETED":
        OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as out_fp:
            json.dump(job.extract_result, out_fp, indent=2)
        print(f"Wrote extraction result to {OUTPUT_JSON_PATH}")
    else:
        raise RuntimeError(
            f"Extract job {job_id} ended with status={job.status}: {job.error_message}"
        )


if __name__ == "__main__":
    main()