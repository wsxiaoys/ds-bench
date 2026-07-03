"""Parse the first two pages of a PDF with LlamaCloud Parse (v2 SDK).

Uploads a PDF to LlamaCloud, submits a single parse job limited to pages 1-2
using the cost_effective tier, and persists the per-page Markdown plus a small
run summary log.
"""

from __future__ import annotations

import os
from pathlib import Path

from llama_cloud import LlamaCloud, file_from_path

PROJECT_DIR = Path("/home/user/myproject")
INPUT_PDF = PROJECT_DIR / "input" / "sample.pdf"
OUTPUT_DIR = PROJECT_DIR / "output"
LOG_PATH = PROJECT_DIR / "output.log"


def main() -> None:
    # The LlamaCloud() client reads LLAMA_CLOUD_API_KEY from the environment.
    if not os.environ.get("LLAMA_CLOUD_API_KEY"):
        raise RuntimeError(
            "LLAMA_CLOUD_API_KEY environment variable is not set; "
            "the LlamaCloud client cannot authenticate without it."
        )

    client = LlamaCloud()

    # 1. Upload the PDF to LlamaCloud with purpose="parse".
    file_obj = client.files.create(
        file=file_from_path(str(INPUT_PDF)),
        purpose="parse",
    )

    # 2. Submit a parse job: cost_effective tier, latest version, pages 1-2,
    #    with inline per-page markdown content.
    result = client.parsing.parse(
        tier="cost_effective",
        version="latest",
        file_id=file_obj.id,
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"],
    )

    job_id = result.job.id  # e.g. "pjb-abc123"

    # 3. Prepare the output directory so it contains exactly the per-page files.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for existing in OUTPUT_DIR.glob("page_*.md"):
        existing.unlink()

    pages = result.markdown.pages if result.markdown else []
    for page in pages:
        # page_number is 1-based; use the API-returned value for the filename.
        page_md_path = OUTPUT_DIR / f"page_{page.page_number}.md"
        page_md_path.write_text(page.markdown, encoding="utf-8")

    # 4. Write the run summary log.
    #    The job id already carries the "pjb-" prefix, so writing it directly
    #    yields the canonical "Job ID: pjb-<job_id>" form.
    with LOG_PATH.open("w", encoding="utf-8") as log:
        log.write(f"Job ID: {job_id}\n")
        log.write(f"Pages parsed: {len(pages)}\n")


if __name__ == "__main__":
    main()