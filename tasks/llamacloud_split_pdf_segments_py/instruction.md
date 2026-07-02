# Split a Concatenated PDF into Logical Segments with LlamaCloud (Python)

## Background
LlamaCloud's `Split` API (beta) is used to automatically segment concatenated PDFs into logical document sections. Given a single PDF that bundles multiple distinct documents (e.g., an essay followed by research papers), the API analyzes each page, classifies it against user-defined categories, and groups consecutive pages of the same category into segments. You will build a small command-line utility, in Python, that drives this API end-to-end.

## Requirements
- Project path: `/home/user/myproject`.
- Implement a Python CLI `run.py` that is invocable as:
  `python3 run.py --pdf <pdf_path> --config <config_path> --output <output_path>`
  - `--pdf`: path to an input PDF file.
  - `--config`: path to a JSON file describing the categories.
  - `--output`: path where the segment result JSON should be written.
  - The CLI must not require any positional arguments or interactive prompts.
- Use the official `llama-cloud` Python SDK (v2.x) to:
  - Upload the PDF with the correct `purpose`.
  - Submit a split job using the categories defined in the configuration file.
  - Wait for the job to finish.
  - Read the segment list off the completed job result.
- Persist the segments to a JSON file at `<output_path>` in a structured format containing the segmented results.
- Authenticate with the `LLAMA_CLOUD_API_KEY` environment variable.

## Implementation Hints
- Install the SDK with `pip install "llama-cloud>=2.7"`. The client is `from llama_cloud import LlamaCloud`.
- File upload uses `client.files.create(file=..., purpose="split")`.
- The split functionality lives under `client.beta.split` (it is a beta resource). The synchronous helper `client.beta.split.split(...)` creates a job and waits for completion, or you can call `create(...)` then `wait_for_completion(job_id, ...)`.
- The categories config JSON file has the following schema:
  ```json
  {
    "categories": [
      { "name": "<category-name>", "description": "<natural-language description>" }
    ]
  }
  ```
  You need to forward those entries to the API as the `categories` parameter (each entry has `name` and `description`).
- The PDF must be referenced via `document_input={"type": "file_id", "value": <uploaded_file_id>}`.
- Each returned segment exposes `category` (string), `pages` (list of 1-based page numbers belonging to the segment), and `confidence_category` (string such as `high`/`medium`/`low`).
- The output JSON file must have the following structure:
  ```json
  {
    "segments": [
      {
        "category": "<category-name>",
        "pages": [<int>, ...],
        "confidence_category": "<high|medium|low>"
      }
    ]
  }
  ```
  - `segments` must be a non-empty array preserving the order returned by the API.
  - Each `pages` array must contain 1-based page numbers as integers.
- Use argparse (or equivalent) for CLI parsing. Reject invalid invocations (e.g., missing arguments) early with a non-zero exit code.

