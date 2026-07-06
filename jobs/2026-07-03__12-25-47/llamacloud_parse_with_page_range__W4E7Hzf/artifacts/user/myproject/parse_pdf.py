import os
from pathlib import Path
from llama_cloud import LlamaCloud

INPUT_PDF = Path("/home/user/myproject/input/sample.pdf")
OUTPUT_DIR = Path("/home/user/myproject/output")
LOG_FILE = Path("/home/user/myproject/output.log")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

client = LlamaCloud()

# Step 1: Upload PDF with purpose='parse'
with open(INPUT_PDF, "rb") as f:
    uploaded = client.files.create(file=f, purpose="parse")
file_id = uploaded.id
print(f"Uploaded file id: {file_id}")

# Step 2: Submit parse job
result = client.parsing.parse(
    file_id=file_id,
    tier="cost_effective",
    version="latest",
    page_ranges={"target_pages": "1-2"},
    expand=["markdown"],
)

job_id = result.job.id
pages = result.markdown.pages if result.markdown else []
print(f"Job ID: {job_id}, pages returned: {len(pages)}")

# Step 3: Save per-page markdown
for page in pages:
    page_num = page.page_number
    md = page.markdown
    out_path = OUTPUT_DIR / f"page_{page_num}.md"
    out_path.write_text(md, encoding="utf-8")
    print(f"Wrote {out_path}")

# Step 4: Write run summary log
with open(LOG_FILE, "w", encoding="utf-8") as lf:
    lf.write(f"Job ID: {job_id}\n")
    lf.write(f"Pages parsed: {len(pages)}\n")
print(f"Wrote {LOG_FILE}")
