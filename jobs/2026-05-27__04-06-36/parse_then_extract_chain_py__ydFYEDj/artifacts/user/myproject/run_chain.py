"""
Parse-then-Extract chain using the LlamaCloud v2 SDK.

Steps:
  1. Upload invoice.pdf with purpose="parse"
  2. Run a Parse job (agentic / latest) → save first-page markdown to parsed.md
  3. Reuse the parse-job ID as file_input for an Extract job
  4. Write the structured result to extracted.json
  5. Append summary lines to output.log
"""

import json
import os
from pathlib import Path
from typing import List

from pydantic import BaseModel
import llama_cloud

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY = os.environ["LLAMA_CLOUD_API_KEY"]
RUN_ID = os.environ["ZEALT_RUN_ID"]

PROJECT_DIR = Path(__file__).parent
PDF_PATH = PROJECT_DIR / "data" / "invoice.pdf"
PARSED_MD_PATH = PROJECT_DIR / "parsed.md"
EXTRACTED_JSON_PATH = PROJECT_DIR / "extracted.json"
LOG_PATH = PROJECT_DIR / "output.log"


# ── Pydantic schema for invoices ───────────────────────────────────────────────
class InvoiceSchema(BaseModel):
    vendor: str
    invoice_number: str
    total_amount: float
    line_items: List[str]


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    client = llama_cloud.LlamaCloud(api_key=API_KEY)

    # 1. Upload the PDF (or reuse an existing upload with the same external_file_id)
    external_file_id = f"invoice-{RUN_ID}"
    print(f"[1/4] Uploading {PDF_PATH} with external_file_id={external_file_id!r} …")
    try:
        with open(PDF_PATH, "rb") as fh:
            uploaded_file = client.files.create(
                file=fh,
                purpose="parse",
                external_file_id=external_file_id,
            )
        file_id = uploaded_file.id
        print(f"      File ID (new upload): {file_id}")
    except llama_cloud.BadRequestError as exc:
        if "duplicate key" not in str(exc) and "UniqueViolation" not in str(exc):
            raise
        # File already exists — look it up by external_file_id
        print("      File already uploaded; looking up by external_file_id …")
        page = client.files.list(external_file_id=external_file_id)
        existing = list(page)
        if not existing:
            raise RuntimeError(
                f"Duplicate upload error but no file found for external_file_id={external_file_id!r}"
            ) from exc
        file_id = existing[0].id
        print(f"      File ID (existing): {file_id}")

    # 2. Run a Parse job and wait for completion
    print("[2/4] Starting Parse job (tier=agentic, version=latest) …")
    parse_job = client.parsing.create(
        file_id=file_id,
        tier="agentic",
        version="latest",
    )
    parse_job_id = parse_job.id  # ParsingCreateResponse.id
    print(f"      Parse Job ID: {parse_job_id}")

    print("      Waiting for Parse job to complete …")
    completed_parse = client.parsing.wait_for_completion(
        parse_job_id,
        verbose=True,
    )
    # wait_for_completion returns a ParsingCreateResponse (the polled status object)
    print(f"      Parse status: {completed_parse.status}")

    # Fetch with markdown expand to get the content
    parse_result = client.parsing.get(
        parse_job_id,
        expand=["markdown"],
    )

    # Extract first-page markdown
    first_page_md = ""
    if parse_result.markdown and parse_result.markdown.pages:
        page = parse_result.markdown.pages[0]
        # MarkdownPage is a Union; successful pages have a .markdown attribute
        if hasattr(page, "markdown"):
            first_page_md = page.markdown
        elif hasattr(page, "error"):
            first_page_md = f"[Parse error on page 1: {page.error}]"
    else:
        first_page_md = "[No markdown content returned]"

    PARSED_MD_PATH.write_text(first_page_md, encoding="utf-8")
    print(f"      Saved first-page markdown to {PARSED_MD_PATH}")

    # 3. Run an Extract job, reusing the parse-job ID as file_input
    print(f"[3/4] Starting Extract job (file_input={parse_job_id!r}) …")
    extract_job = client.extract.create(
        file_input=parse_job_id,
        configuration={
            "data_schema": InvoiceSchema.model_json_schema(),
        },
    )
    extract_job_id = extract_job.id
    print(f"      Extract Job ID: {extract_job_id}")

    print("      Waiting for Extract job to complete …")
    completed_extract = client.extract.wait_for_completion(
        extract_job_id,
        verbose=True,
    )
    print(f"      Extract status: {completed_extract.status}")

    # 4. Persist the structured result
    extract_result = completed_extract.extract_result
    # extract_result can be a list (per_doc returns a list with one item) or dict
    if isinstance(extract_result, list) and len(extract_result) > 0:
        result_to_save = extract_result[0]
    else:
        result_to_save = extract_result

    EXTRACTED_JSON_PATH.write_text(
        json.dumps(result_to_save, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"      Saved extraction result to {EXTRACTED_JSON_PATH}")

    # 5. Append summary lines to output.log
    with LOG_PATH.open("a", encoding="utf-8") as log:
        log.write(f"Parse Job ID: {parse_job_id}\n")
        log.write(f"Extract Job ID: {extract_job_id}\n")
    print(f"[4/4] Appended job IDs to {LOG_PATH}")

    print("\n✓ Done.")
    print(f"  Parse Job ID : {parse_job_id}")
    print(f"  Extract Job ID: {extract_job_id}")


if __name__ == "__main__":
    main()
