#!/usr/bin/env python3
"""
Parse a PDF using the LlamaCloud Python SDK (v2.x).

Outputs:
  - /home/user/myproject/output/markdown.md   – full parsed markdown
  - /home/user/myproject/output/images/page_<N>.png – per-page screenshots
  - /home/user/myproject/output/output.log    – summary log
"""

import io
import os
import httpx
from pathlib import Path
from PIL import Image
from llama_cloud import LlamaCloud

# ── Paths ──────────────────────────────────────────────────────────────────────
INPUT_PDF   = Path("/home/user/myproject/input.pdf")
OUTPUT_DIR  = Path("/home/user/myproject/output")
IMAGES_DIR  = OUTPUT_DIR / "images"
MD_FILE     = OUTPUT_DIR / "markdown.md"
LOG_FILE    = OUTPUT_DIR / "output.log"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# ── Client ─────────────────────────────────────────────────────────────────────
# Reads LLAMA_CLOUD_API_KEY from the environment automatically.
client = LlamaCloud()

# ── 1. Upload the PDF ──────────────────────────────────────────────────────────
print(f"Uploading {INPUT_PDF} …")
with open(INPUT_PDF, "rb") as fh:
    file_obj = client.files.create(file=(INPUT_PDF.name, fh, "application/pdf"),
                                   purpose="parse")
file_id = file_obj.id
print(f"  File uploaded, id={file_id}")

# ── 2. Submit parse job and wait for completion ────────────────────────────────
# expand includes both markdown pages and images_content_metadata (presigned URLs).
print("Submitting parse job …")
result = client.parsing.parse(
    file_id=file_id,
    tier="cost_effective",
    version="latest",
    output_options={
        "images_to_save": ["screenshot"],
    },
    expand=["markdown", "images_content_metadata"],
    polling_interval=2.0,
    max_interval=10.0,
    timeout=7200.0,
    verbose=True,
)

job_id = result.job.id
print(f"  Job completed, id={job_id}")

# ── 3. Build markdown from per-page content ────────────────────────────────────
markdown_parts = []
if result.markdown and result.markdown.pages:
    for page in result.markdown.pages:
        if page.success:                       # MarkdownPageMarkdownResultPage
            markdown_parts.append(page.markdown)
        else:                                  # MarkdownPageFailedMarkdownPage
            markdown_parts.append(f"<!-- page {page.page_number} failed: {page.error} -->")

markdown_text = "\n\n".join(markdown_parts)

MD_FILE.write_text(markdown_text, encoding="utf-8")
markdown_chars = len(markdown_text)
print(f"  Markdown written: {markdown_chars} chars → {MD_FILE}")

# ── 4. Download per-page screenshot images ─────────────────────────────────────
image_count = 0

if result.images_content_metadata and result.images_content_metadata.images:
    # Collect only screenshot-category images, sorted by index for stable ordering.
    screenshots = sorted(
        [img for img in result.images_content_metadata.images
         if img.category == "screenshot" or img.category is None],
        key=lambda img: img.index,
    )

    print(f"  Downloading {len(screenshots)} screenshot image(s) …")
    for i, img_meta in enumerate(screenshots, start=1):
        if not img_meta.presigned_url:
            print(f"    Warning: no presigned URL for image index {img_meta.index}, skipping.")
            continue

        resp = httpx.get(img_meta.presigned_url, follow_redirects=True, timeout=120)
        resp.raise_for_status()

        raw_bytes = resp.content
        out_path = IMAGES_DIR / f"page_{i}.png"

        # Ensure the file is written as a valid PNG regardless of what the
        # API returns (it may serve JPEGs even when named .png).
        PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
        if raw_bytes[:8] != PNG_MAGIC:
            # Convert to PNG via Pillow
            img = Image.open(io.BytesIO(raw_bytes))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            raw_bytes = buf.getvalue()

        out_path.write_bytes(raw_bytes)
        print(f"    Saved {out_path} ({len(raw_bytes)} bytes)")
        image_count += 1

# ── 5. Write log ───────────────────────────────────────────────────────────────
log_lines = [
    f"Parse job ID: {job_id}",
    f"Markdown chars: {markdown_chars}",
    f"Image count: {image_count}",
]
LOG_FILE.write_text("\n".join(log_lines) + "\n", encoding="utf-8")

print()
print("Done.")
for line in log_lines:
    print(f"  {line}")
print(f"  Log written → {LOG_FILE}")
