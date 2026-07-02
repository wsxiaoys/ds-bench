# Parse a PDF and Extract Per-Page Screenshots with LlamaParse

## Background
LlamaCloud's LlamaParse platform offers agentic, layout-aware document parsing through the `llama-cloud` Python SDK. In addition to producing clean markdown output, Parse can emit image assets (per-page screenshots, embedded images, or layout crops) that downstream pipelines need for grounding, citations, or visual review.

Your job is to parse a PDF located at `/home/user/myproject/input.pdf` using the LlamaCloud Python SDK, retrieve both the markdown content and the per-page screenshot images, save them to disk, and write a small log file summarizing the result.

## Requirements
- Use the **`llama-cloud` Python SDK (v2.x)** to interact with the LlamaCloud Parse API. The SDK reads `LLAMA_CLOUD_API_KEY` from the environment.
- Upload `/home/user/myproject/input.pdf` to LlamaCloud as a parse source file.
- Submit a Parse job and request **per-page screenshot images** in the parse output options. Use a non-deprecated parse tier and ask for the markdown content as well.
- After the job completes, save:
  - The full parsed markdown text to `/home/user/myproject/output/markdown.md`.
  - One PNG image file per page screenshot under `/home/user/myproject/output/images/`. Name each file `page_<N>.png` where `<N>` is the 1-based page number (e.g., `page_1.png`, `page_2.png`).
- Write a log file to `/home/user/myproject/output/output.log` summarizing the parse run. The log file must contain, on separate lines, the following entries (in any order):
  - `Parse job ID: <job_id>` where `<job_id>` is the LlamaCloud parse job identifier (which starts with `pjb-`).
  - `Markdown chars: <n>` where `<n>` is the integer character length of the markdown file written to disk.
  - `Image count: <n>` where `<n>` is the integer number of screenshot files written under `/home/user/myproject/output/images/`.

## Implementation Hints
- Install with `pip install "llama-cloud>=2.7"` (already preinstalled in the environment) and instantiate `LlamaCloud()` — it reads the API key from the env automatically.
- Upload the PDF with `client.files.create(file=..., purpose="parse")`.
- The synchronous helper `client.parsing.parse(...)` uploads-or-references the file, submits the job, polls until completion, and returns the parsed result. To request per-page screenshots, configure `output_options.images_to_save` and include the appropriate `expand` entries (markdown + image content metadata) so the SDK returns both outputs in one call.
- The image content metadata returned by the SDK contains downloadable references for each screenshot; for each image you need to fetch the bytes and write them to disk under the `images/` directory.
- The markdown response object exposes the parsed pages — concatenate the per-page markdown content (separated by blank lines) when writing `markdown.md`.

