import json
import os
import time
from pathlib import Path

from llama_cloud import BadRequestError, LlamaCloud
from pydantic import BaseModel, Field


class InvoiceSchema(BaseModel):
    company_name: str = Field(..., description="Name of the company issuing the invoice")
    invoice_number: str = Field(..., description="Invoice identifier")
    total_amount: float = Field(..., description="Total amount due on the invoice")


def main() -> None:
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID environment variable is required")

    client = LlamaCloud()

    invoice_path = Path(__file__).resolve().parent / "sample_invoice.txt"
    if not invoice_path.exists():
        raise FileNotFoundError(f"Missing invoice file: {invoice_path}")

    external_file_id = f"invoice-{run_id}.txt"
    try:
        uploaded_file = client.files.create(
            file=str(invoice_path),
            purpose="extract",
            external_file_id=external_file_id,
        )
    except BadRequestError as exc:
        if "duplicate key" not in str(exc):
            raise
        existing_files = list(client.files.list(external_file_id=external_file_id))
        if not existing_files:
            raise
        uploaded_file = existing_files[0]

    extraction_job = client.extract.create(
        file_input=uploaded_file.id,
        configuration={
            "data_schema": InvoiceSchema.model_json_schema(),
            "extraction_target": "per_doc",
            "tier": "agentic",
            "cite_sources": True,
        },
    )

    terminal_statuses = {"COMPLETED", "FAILED", "CANCELLED"}
    while extraction_job.status not in terminal_statuses:
        time.sleep(2)
        extraction_job = client.extract.get(
            extraction_job.id, expand=["extract_metadata"]
        )

    extraction_job = client.extract.get(
        extraction_job.id, expand=["extract_metadata"]
    )

    log_path = invoice_path.parent / "output.log"
    log_path.write_text(
        f"Extract job: {extraction_job.id}\nStatus: {extraction_job.status}\n",
        encoding="utf-8",
    )

    if extraction_job.status != "COMPLETED":
        raise RuntimeError(f"Extraction failed with status: {extraction_job.status}")

    extract_result = extraction_job.extract_result
    if hasattr(extract_result, "model_dump"):
        extract_payload = extract_result.model_dump(mode="json")
    else:
        extract_payload = extract_result

    extract_metadata = extraction_job.extract_metadata
    if hasattr(extract_metadata, "model_dump"):
        extract_metadata_payload = extract_metadata.model_dump(mode="json")
    else:
        extract_metadata_payload = extract_metadata or {}

    field_metadata = {}
    if isinstance(extract_metadata_payload, dict):
        field_metadata = extract_metadata_payload.get("field_metadata", {})
        if isinstance(field_metadata, dict) and "document_metadata" in field_metadata:
            field_metadata = field_metadata.get("document_metadata", {})

    normalized_extract_metadata = {"field_metadata": field_metadata}
    if isinstance(extract_metadata_payload, dict):
        if "parse_job_id" in extract_metadata_payload:
            normalized_extract_metadata["parse_job_id"] = extract_metadata_payload[
                "parse_job_id"
            ]
        if "parse_tier" in extract_metadata_payload:
            normalized_extract_metadata["parse_tier"] = extract_metadata_payload[
                "parse_tier"
            ]

    output_payload = {
        "data": extract_payload,
        "extract_metadata": normalized_extract_metadata,
    }

    result_path = invoice_path.parent / "result.json"
    result_path.write_text(json.dumps(output_payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
