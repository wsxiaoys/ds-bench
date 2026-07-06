"""
Parse-then-Extract chain with LlamaCloud (v2 SDK).

Pipeline:
  1. Upload data/invoice.pdf with purpose="parse" and an external_file_id that
     ends with the value read from /logs/artifacts/run-id.
  2. Kick off a Parse job (tier="agentic", version="latest", markdown output).
  3. Wait for the parse job to reach COMPLETED, then save the first page's
     markdown to parsed.md.
  4. Reuse the parse-job ID (pjb-...) as file_input for an Extract job using a
     Pydantic-defined data_schema (no re-upload).
  5. Wait for the extract job, persist extract_result as JSON to extracted.json.
  6. Append single-line summaries for both jobs to output.log.
"""

import json
import os
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field
from llama_cloud import LlamaCloud

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
PROJECT_DIR = Path("/home/user/myproject")
PDF_PATH = PROJECT_DIR / "data" / "invoice.pdf"
PARSED_MD_PATH = PROJECT_DIR / "parsed.md"
EXTRACTED_JSON_PATH = PROJECT_DIR / "extracted.json"
OUTPUT_LOG_PATH = PROJECT_DIR / "output.log"
RUN_ID_PATH = Path("/logs/artifacts/run-id")


# --------------------------------------------------------------------------- #
# Pydantic schema for the invoice extraction
# --------------------------------------------------------------------------- #
class Invoice(BaseModel):
    vendor: str = Field(..., description="The name of the vendor/supplier that issued the invoice.")
    invoice_number: str = Field(..., description="The identifier printed on the invoice (e.g. INV-1234).")
    total_amount: float = Field(..., description="The grand total amount due on the invoice.")
    line_items: List[str] = Field(
        default_factory=list,
        description="A list of the individual line items appearing on the invoice "
        "(one descriptive string per line item).",
    )


def log_line(line: str) -> None:
    """Append a single line to output.log and print it for visibility."""
    print(line)
    with OUTPUT_LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def main() -> None:
    # Make sure we start with a clean log file so each run appends fresh lines.
    OUTPUT_LOG_PATH.touch(exist_ok=True)

    # Read the run id - it will be appended to the external_file_id.
    run_id = RUN_ID_PATH.read_text(encoding="utf-8").strip()
    if not run_id:
        raise RuntimeError(f"run-id file at {RUN_ID_PATH} is empty.")

    # API key comes from the environment - the v2 client picks it up REDACTEDmatically.
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise RuntimeError("LLAMA_CLOUD_API_KEY is not set in the environment.")

    client = LlamaCloud(api_key=api_key)

    # ---------------------------------------------------------------- #
    # 1. Upload the PDF (purpose="parse", external_file_id ending in run_id)
    # ---------------------------------------------------------------- #
    external_file_id = f"invoice-{run_id}"
    with PDF_PATH.open("rb") as fh:
        uploaded = client.files.create(file=fh, purpose="parse", external_file_id=external_file_id)
    print(f"Uploaded file id={uploaded.id} external_file_id={uploaded.external_file_id}")

    # ---------------------------------------------------------------- #
    # 2. Create a Parse job (agentic tier, latest version, markdown output)
    # ---------------------------------------------------------------- #
    # The parse job defaults to producing markdown; we explicitly request it
    # anyway via `output_options` so the contract is obvious in the script.
    parse_job = client.parsing.create(
        tier="agentic",
        version="latest",
        file_id=uploaded.id,
        output_options={"markdown": {}},
    )
    print(f"Created parse job id={parse_job.id} status={parse_job.status}")

    # ---------------------------------------------------------------- #
    # 3. Wait for it to complete and grab the first page's markdown
    # ---------------------------------------------------------------- #
    completed = client.parsing.wait_for_completion(parse_job.id)
    if completed.status != "COMPLETED":
        raise RuntimeError(
            f"Parse job {parse_job.id} ended in status={completed.status} "
            f"error={getattr(completed, 'error_message', None)}"
        )

    md_result = client.parsing.get(parse_job.id, expand=["markdown"])
    pages = (md_result.markdown.pages if md_result.markdown else []) or []
    if not pages:
        raise RuntimeError("Parse job produced no markdown pages.")

    first_page = next(
        (p for p in pages if getattr(p, "page_number", None) == 1),
        pages[0],
    )
    first_page_md = first_page.markdown or ""

    PARSED_MD_PATH.write_text(first_page_md, encoding="utf-8")
    print(f"Wrote {len(first_page_md)} chars of first-page markdown to {PARSED_MD_PATH}")

    # The parse job ID is what we chain into Extract.
    parse_job_id = parse_job.id

    # ---------------------------------------------------------------- #
    # 4. Run Extract using the pjb-... ID as file_input (no re-upload)
    # ---------------------------------------------------------------- #
    data_schema = Invoice.model_json_schema()
    extract_job = client.extract.create(
        file_input=parse_job_id,
        configuration={"data_schema": data_schema},
    )
    print(f"Created extract job id={extract_job.id} status={extract_job.status}")

    # ---------------------------------------------------------------- #
    # 5. Wait for the extract job and save the structured result
    # ---------------------------------------------------------------- #
    completed_extract = client.extract.wait_for_completion(extract_job.id)
    if completed_extract.status != "COMPLETED":
        raise RuntimeError(
            f"Extract job {extract_job.id} ended in status={completed_extract.status} "
            f"error={getattr(completed_extract, 'error_message', None)}"
        )

    extract_result = completed_extract.extract_result
    EXTRACTED_JSON_PATH.write_text(json.dumps(extract_result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote extract_result to {EXTRACTED_JSON_PATH}")

    # ---------------------------------------------------------------- #
    # 6. Log one line per job
    # ---------------------------------------------------------------- #
    log_line(f"Parse Job ID: {parse_job_id}")
    log_line(f"Extract Job ID: {completed_extract.id}")


if __name__ == "__main__":
    main()
