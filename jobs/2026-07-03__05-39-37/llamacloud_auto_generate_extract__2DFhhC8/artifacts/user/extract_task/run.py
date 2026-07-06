"""
Auto-generate a LlamaExtract JSON Schema from a natural-language prompt and run
structured extraction end-to-end against a real invoice PDF using the
LlamaCloud Python SDK (llama-cloud>=2).
"""

import json
import os
import sys
import time
from pathlib import Path

from llama_cloud import LlamaCloud

# --------------------------------------------------------------------------- #
# Paths & configuration
# --------------------------------------------------------------------------- #
BASE_DIR = Path("/home/user/extract_task")
PDF_PATH = BASE_DIR / "data" / "invoice.pdf"
SCHEMA_PATH = BASE_DIR / "schema.json"
RESULT_PATH = BASE_DIR / "result.json"
LOG_PATH = BASE_DIR / "output.log"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

# The prompt used to *guide* the REDACTED-generated schema.  It deliberately names
# the standard invoice concepts required by the task so the generated schema
# covers an invoice number, a vendor/supplier, and a total amount.
SCHEMA_PROMPT = (
    "Extract structured invoice data from this document. "
    "Include the invoice number or invoice ID, the vendor / supplier / seller "
    "or merchant name, the invoice date, line items with description and amount, "
    "the subtotal, any tax, and the total amount due. "
    "Return a JSON object schema with descriptive property names."
)

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def read_run_id() -> str:
    """Read the run-id artifact and strip whitespace."""
    raw = RUN_ID_PATH.read_text()
    run_id = raw.strip()
    if not run_id:
        raise RuntimeError(f"Empty run-id read from {RUN_ID_PATH}")
    return run_id


def save_json(path: Path, obj) -> None:
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def get_data_schema(generated) -> dict:
    """Pull the JSON Schema out of the ConfigurationCreate returned by
    generate_schema, accommodating the discriminated `parameters` union."""
    params = getattr(generated, "parameters", None)
    if params is None:
        raise RuntimeError("generate_schema returned no parameters")

    # ExtractV2Parameters exposes `.data_schema`
    data_schema = getattr(params, "data_schema", None)
    if data_schema is None:
        # Fall back to dict access in case of an untyped parameters object
        params_dict = params.to_dict() if hasattr(params, "to_dict") else dict(params)
        data_schema = params_dict.get("data_schema")
    if data_schema is None:
        raise RuntimeError("Could not locate data_schema on generated configuration")

    return dict(data_schema)


def validate_schema(schema: dict) -> list:
    """Validate that the generated schema meets the task requirements and
    return the list of top-level property names."""
    if not isinstance(schema, dict):
        raise RuntimeError(f"Schema is not a JSON object (got {type(schema).__name__})")
    if schema.get("type") != "object":
        raise RuntimeError(f'Schema "type" is not "object" (got {schema.get("type")!r})')
    properties = schema.get("properties")
    if not isinstance(properties, dict) or not properties:
        raise RuntimeError("Schema has no properties map")
    field_names = list(properties.keys())
    if len(field_names) < 3:
        raise RuntimeError(f"Schema has fewer than 3 properties: {field_names}")
    return field_names


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main() -> None:
    # 1. Authenticate
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise RuntimeError("LLAMA_CLOUD_API_KEY environment variable is not set")
    client = LlamaCloud(api_key=api_key)

    # 2. Read run-id and build external_file_id
    run_id = read_run_id()
    external_file_id = f"invoice-{run_id}.pdf"
    print(f"[run] run-id={run_id}  external_file_id={external_file_id}")

    if not PDF_PATH.exists():
        raise FileNotFoundError(f"Input PDF not found: {PDF_PATH}")

    # 3. Upload the PDF with purpose="extract" and the required external_file_id
    print("[run] uploading PDF ...")
    with open(PDF_PATH, "rb") as fh:
        file_resp = client.files.create(
            file=(PDF_PATH.name, fh, "application/pdf"),
            purpose="extract",
            external_file_id=external_file_id,
        )
    file_id = file_resp.id
    print(f"[run] uploaded file_id={file_id}")

    # 4. Auto-generate a JSON Schema from the prompt + sample document
    print("[run] generating schema ...")
    generated = client.extract.generate_schema(
        prompt=SCHEMA_PROMPT,
        file_id=file_id,
    )
    data_schema = get_data_schema(generated)
    save_json(SCHEMA_PATH, data_schema)
    print(f"[run] schema saved -> {SCHEMA_PATH}")

    field_names = validate_schema(data_schema)
    print(f"[run] schema fields: {field_names}")

    # 5. Run structured extraction using the generated schema
    configuration = {
        "data_schema": data_schema,
        "extraction_target": "per_doc",
        "tier": "agentic",
    }
    print("[run] creating extract job ...")
    job = client.extract.create(
        file_input=file_id,
        configuration=configuration,
    )
    job_id = job.id
    print(f"[run] job_id={job_id}  initial_status={job.status}")

    # 6. Poll until terminal state
    TERMINAL = {"COMPLETED", "FAILED", "CANCELLED"}
    if job.status in TERMINAL:
        final_job = job
    else:
        print("[run] waiting for completion ...")
        final_job = client.extract.wait_for_completion(job_id, polling_interval=2.0, timeout=1800.0)
    status = final_job.status
    print(f"[run] final status: {status}")

    if status != "COMPLETED":
        err = getattr(final_job, "error_message", None)
        raise RuntimeError(f"Extract job did not complete (status={status}): {err}")

    # 7. Extract the result
    extract_result = final_job.extract_result
    if extract_result is None:
        raise RuntimeError("Completed job has no extract_result")

    # extract_result may be a dict, a list of dicts, or a pydantic-like object.
    if isinstance(extract_result, (list, tuple)):
        result_obj = [dict(r) if hasattr(r, "to_dict") else r for r in extract_result]
    elif hasattr(extract_result, "to_dict"):
        result_obj = extract_result.to_dict()
    elif isinstance(extract_result, dict):
        result_obj = dict(extract_result)
    else:
        result_obj = extract_result

    save_json(RESULT_PATH, result_obj)
    print(f"[run] result saved -> {RESULT_PATH}")

    # 8. Write the exactly-three-line log file
    log_lines = [
        f"Schema fields: {', '.join(field_names)}",
        f"Job ID: {job_id}",
        f"Status: {status}",
    ]
    with open(LOG_PATH, "w") as fh:
        fh.write("\n".join(log_lines) + "\n")
    print(f"[run] log saved -> {LOG_PATH}")

    # 9. Sanity-check the result has at least one populated field
    if isinstance(result_obj, list):
        populated = any(bool(r) for r in result_obj if isinstance(r, dict))
    elif isinstance(result_obj, dict):
        populated = any(v not in (None, "", [], {}) for v in result_obj.values())
    else:
        populated = bool(result_obj)
    if not populated:
        raise RuntimeError("Extract result has no populated fields")
    print("[run] DONE")


if __name__ == "__main__":
    main()