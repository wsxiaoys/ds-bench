"""Parse the first two pages of a PDF with LlamaCloud Parse (v2) cost_effective tier."""

import os
from pathlib import Path

from llama_cloud import LlamaCloud

INPUT_PDF = Path("/home/user/myproject/input/sample.pdf")
OUTPUT_DIR = Path("/home/user/myproject/output")
LOG_FILE = Path("/home/user/myproject/output.log")


def main() -> None:
    # Ensure the output directory exists before writing files into it.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # The SDK picks up LLAMA_CLOUD_API_KEY (or LLAMA_PARSE_API_KEY) REDACTEDmatically.
    client = LlamaCloud()

    # 1) Upload the PDF with purpose="parse".
    with INPUT_PDF.open("rb") as fh:
        uploaded = client.files.create(file=fh, purpose="parse")
    print(f"Uploaded file id: {uploaded.id}")

    # 2) Submit a parse job limited to pages 1-2 using the cost_effective tier,
    #    expanding inline per-page markdown.
    result = client.parsing.parse(
        file_id=uploaded.id,
        tier="cost_effective",
        version="latest",
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"],
        verbose=True,
    )

    job_id = result.job.id
    print(f"Job ID: {job_id}")

    if result.markdown is None or result.markdown.pages is None:
        raise RuntimeError("No markdown pages were returned by the parse job.")

    # 3) Persist each page's Markdown using the API's 1-based page_number.
    saved_paths: list[Path] = []
    for page in result.markdown.pages:
        out_path = OUTPUT_DIR / f"page_{page.page_number}.md"
        out_path.write_text(page.markdown, encoding="utf-8")
        saved_paths.append(out_path)
        print(f"Wrote {out_path} ({len(page.markdown)} chars)")

    # 4) Clean up: ensure the output directory contains exactly the per-page files.
    expected = {OUTPUT_DIR / f"page_{i + 1}.md" for i in range(len(result.markdown.pages))}
    for stale in OUTPUT_DIR.iterdir():
        if stale not in expected:
            stale.unlink()

    # 5) Write the run summary log file. The API returns IDs that already start
    # with the "pjb-" prefix; normalize to a bare identifier so the required
    # log line follows the exact `Job ID: pjb-<job_id>` shape.
    bare_job_id = job_id[len("pjb-"):] if job_id.startswith("pjb-") else job_id
    page_count = len(result.markdown.pages)
    LOG_FILE.write_text(
        f"Job ID: pjb-{bare_job_id}\n"
        f"Pages parsed: {page_count}\n",
        encoding="utf-8",
    )
    print(f"Wrote log file {LOG_FILE}")


if __name__ == "__main__":
    main()