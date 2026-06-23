import json
import os
from pathlib import Path

from llama_cloud import LlamaCloud

BASE_DIR = Path("/home/user/extract_task")
DATA_DIR = BASE_DIR / "data"
PDF_PATH = DATA_DIR / "invoice.pdf"
SCHEMA_PATH = BASE_DIR / "schema.json"
RESULT_PATH = BASE_DIR / "result.json"
LOG_PATH = BASE_DIR / "output.log"


def main() -> None:
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID is not set")

    client = LlamaCloud()

    with PDF_PATH.open("rb") as handle:
        upload = client.files.create(
            file=handle,
            purpose="extract",
            external_file_id=f"invoice-{run_id}.pdf",
        )

    prompt = (
        "Generate a JSON schema for invoice extraction. Include fields for invoice number or id, "
        "vendor or supplier, invoice date, line items, subtotal, tax, and total amount."
    )

    generated = client.extract.generate_schema(
        prompt=prompt,
        file_id=upload.id,
    )

    data_schema = generated.parameters.data_schema
    with SCHEMA_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data_schema, handle, indent=2, ensure_ascii=False)

    schema_fields = list(data_schema.get("properties", {}).keys())

    configuration = {
        "data_schema": data_schema,
        "extraction_target": "per_doc",
        "tier": "agentic",
    }

    job = client.extract.create(
        file_input=upload.id,
        configuration=configuration,
    )

    job = client.extract.wait_for_completion(job.id)

    with RESULT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(job.extract_result or {}, handle, indent=2, ensure_ascii=False)

    with LOG_PATH.open("w", encoding="utf-8") as handle:
        handle.write(f"Schema fields: {', '.join(schema_fields)}\n")
        handle.write(f"Job ID: {job.id}\n")
        handle.write(f"Status: {job.status}\n")


if __name__ == "__main__":
    main()
