"""
LlamaCloud Parse v2 – upload a PDF and parse pages 1-2 with the
cost_effective tier, then save per-page Markdown and a run summary.
"""

import os
import pathlib
from llama_cloud import LlamaCloud

# ── paths ──────────────────────────────────────────────────────────────────
PROJECT_DIR = pathlib.Path("/home/user/myproject")
INPUT_PDF   = PROJECT_DIR / "input" / "sample.pdf"
OUTPUT_DIR  = PROJECT_DIR / "output"
LOG_FILE    = PROJECT_DIR / "output.log"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── client (picks up LLAMA_CLOUD_API_KEY automatically) ───────────────────
client = LlamaCloud()

# ── 1. upload the PDF ─────────────────────────────────────────────────────
print(f"Uploading {INPUT_PDF} …")
with open(INPUT_PDF, "rb") as fh:
    uploaded_file = client.files.create(
        file=(INPUT_PDF.name, fh, "application/pdf"),
        purpose="parse",
    )
print(f"  → file id: {uploaded_file.id}")

# ── 2. submit parse job (pages 1-2, cost_effective tier) and wait ─────────
print("Submitting parse job …")
result = client.parsing.parse(
    tier="cost_effective",
    version="latest",
    file_id=uploaded_file.id,
    page_ranges={"target_pages": "1-2"},
    expand=["markdown"],
    verbose=True,
)
print(f"  → job id : {result.job.id}")
print(f"  → status : {result.job.status}")

# ── 3. save per-page Markdown ─────────────────────────────────────────────
pages = result.markdown.pages  # List[MarkdownPage]
for page in pages:
    if not page.success:
        print(f"  ⚠  page {page.page_number} failed: {page.error}")
        continue
    out_path = OUTPUT_DIR / f"page_{page.page_number}.md"
    out_path.write_text(page.markdown, encoding="utf-8")
    print(f"  saved {out_path} ({len(page.markdown)} chars)")

# ── 4. write run summary log ──────────────────────────────────────────────
page_count = len(pages)
LOG_FILE.write_text(
    f"Job ID: {result.job.id}\n"
    f"Pages parsed: {page_count}\n",
    encoding="utf-8",
)
print(f"\nLog written to {LOG_FILE}")
print(f"Job ID: {result.job.id}")
print(f"Pages parsed: {page_count}")
