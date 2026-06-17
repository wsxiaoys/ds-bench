# Extract Structured Resume Fields with LlamaCloud Extract (Python)

## Background
LlamaCloud is LlamaIndex's hosted document-AI platform. Its **Extract** product turns unstructured documents into structured JSON that matches a schema you define. You will use the **v2** Python SDK (`llama-cloud`) to upload a resume PDF, define a schema with Pydantic, run an extraction job, and persist the result to disk.

A single-page resume PDF has been prepared for you at `/home/user/myproject/resume.pdf`. It contains a candidate's name, email address, and a list of technical skills.

## Requirements
- Write a Python script at `/home/user/myproject/extract_resume.py` that:
  - Reads the `LLAMA_CLOUD_API_KEY` and `ZEALT_RUN_ID` environment variables.
  - Uploads `/home/user/myproject/resume.pdf` to LlamaCloud with `purpose="extract"`. To keep file uploads isolated across concurrent runs, pass `external_file_id="harbor-resume-${run-id}"` where `run-id` comes from `ZEALT_RUN_ID`.
  - Defines a Pydantic model `Resume` with the fields `name: str`, `email: str`, and `skills: list[str]`, each carrying a `description`.
  - Creates an Extract job using `client.extract.create(...)` with `extraction_target="per_doc"` and the `agentic` tier, using the Pydantic-derived JSON schema.
  - Waits for the job to reach a terminal state (`COMPLETED`, `FAILED`, or `CANCELLED`).
  - On `COMPLETED`, writes the `extract_result` dict to `/home/user/myproject/output.json` as pretty-printed JSON.
  - Appends a single line to `/home/user/myproject/output.log` in the exact format `Job ID: <job_id>` (the `<job_id>` value is the id returned by `client.extract.create(...)`).
- Run the script once so that the output artifacts exist.

## Implementation Hints
- Install the latest v2 SDK with `pip install "llama-cloud>=2.7"`. Do **NOT** install `llama-cloud-services` — it pins the legacy `llama-cloud<0.2` and conflicts with the v2 SDK.
- The v2 Extract `create` call uses a **flattened** `configuration` dict (no `extract_options` wrapper). Required keys: `data_schema`, `extraction_target`, `tier`.
- `client.files.create(...)` accepts a path string, a `Path`, a `BytesIO`, or a `(filename, bytes, mime_type)` tuple.
- Poll with `client.extract.get(job.id)` or call `client.extract.wait_for_completion(job.id)` until status is terminal.
- The `extract_result` is already a JSON-serializable dict — `json.dump(job.extract_result, fp, indent=2)` is sufficient.
- Read `ZEALT_RUN_ID` with `os.environ["ZEALT_RUN_ID"]` so that the `external_file_id` is `harbor-resume-<run-id>` (e.g., `harbor-resume-zr-abc123`).

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the script is executed and the output artifacts exist (no mocking — a real LlamaCloud extract job must run).
- Script path: `/home/user/myproject/extract_resume.py`
- Output JSON: `/home/user/myproject/output.json` — a JSON object containing the keys `name` (string), `email` (string), and `skills` (array of strings).
- Log file: `/home/user/myproject/output.log` — contains exactly one line in the format `Job ID: <job_id>` where `<job_id>` is the id of the Extract job created via the v2 SDK.
- The uploaded file's `external_file_id` must equal `harbor-resume-${run-id}` where `${run-id}` is the value of the `ZEALT_RUN_ID` environment variable.
- The Extract job id recorded in `output.log` must correspond to a real LlamaCloud Extract job whose status is `COMPLETED`.

