#!/usr/bin/env python3
"""
Parse a PDF with LlamaCloud (LlamaParse) and extract:
  - the full parsed markdown text
  - one PNG screenshot per page

Outputs are written under /home/user/myproject/output/ and a small log file
summarizes the run.
"""

import os
import sys
import io
import requests
from PIL import Image

import llama_cloud
from llama_cloud.types.parse_v2_parameters import OutputOptions

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INPUT_PDF = "/home/user/myproject/input.pdf"
OUTPUT_DIR = "/home/user/myproject/output"
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
MARKDOWN_PATH = os.path.join(OUTPUT_DIR, "markdown.md")
LOG_PATH = os.path.join(OUTPUT_DIR, "output.log")


def main() -> None:
    os.makedirs(IMAGES_DIR, exist_ok=True)

    # The SDK reads LLAMA_CLOUD_API_KEY from the environment REDACTEDmatically.
    client = llama_cloud.LlamaCloud()

    # 1. Upload the PDF to LlamaCloud as a parse source file.
    with open(INPUT_PDF, "rb") as fh:
        file_obj = (os.path.basename(INPUT_PDF), fh.read(), "application/pdf")
        upload = client.files.create(file=file_obj, purpose="parse")
    file_id = upload.id
    print(f"Uploaded file: id={file_id}, name={upload.name}")

    # 2. Submit a Parse job requesting per-page screenshot images + markdown.
    #    tier="agentic" is a non-deprecated parse tier.
    #    expand returns both the markdown and the image content metadata
    #    (which carries the presigned download URLs) in a single response.
    result = client.parsing.parse(
        tier="agentic",
        version="latest",
        file_id=file_id,
        output_options=OutputOptions(
            images_to_save=["screenshot"],
            markdown={},
        ),
        expand=["markdown", "images_content_metadata"],
        verbose=True,
    )

    job_id = result.job.id
    print(f"Parse job ID: {job_id}")

    # 3. Build the full markdown from the per-page results.
    md_parts = []
    if result.markdown and result.markdown.pages:
        pages = sorted(result.markdown.pages, key=lambda p: p.page_number)
        for page in pages:
            # Successful pages expose `.markdown`; failed pages expose `.error`.
            if getattr(page, "success", False):
                md_parts.append(page.markdown)
            else:
                md_parts.append(f"<!-- page {page.page_number} failed: {page.error} -->")
    markdown_text = "\n\n".join(md_parts)

    with open(MARKDOWN_PATH, "w", encoding="utf-8") as fh:
        fh.write(markdown_text)
    md_chars = len(markdown_text)
    print(f"Wrote markdown ({md_chars} chars) -> {MARKDOWN_PATH}")

    # 4. Download each per-page screenshot and write it to disk.
    image_count = 0
    if result.images_content_metadata and result.images_content_metadata.images:
        screenshots = [
            img
            for img in result.images_content_metadata.images
            if img.category == "screenshot"
        ]
        # Sort by index so screenshots are in page order, then number 1-based.
        screenshots.sort(key=lambda img: img.index)
        for n, img in enumerate(screenshots, start=1):
            url = img.presigned_url
            if not url:
                print(f"WARNING: screenshot {n} has no presigned_url, skipping")
                continue
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            # Screenshots are returned as JPEG; convert to PNG so the
            # saved files are genuine PNG images named page_<N>.png.
            img = Image.open(io.BytesIO(resp.content))
            img = img.convert("RGB")
            out_path = os.path.join(IMAGES_DIR, f"page_{n}.png")
            img.save(out_path, format="PNG")
            image_count += 1
            print(f"Wrote page_{n}.png ({os.path.getsize(out_path)} bytes)")
    print(f"Wrote {image_count} screenshot images -> {IMAGES_DIR}")

    # 5. Write the log / summary file.
    log_lines = [
        f"Parse job ID: {job_id}",
        f"Markdown chars: {md_chars}",
        f"Image count: {image_count}",
    ]
    with open(LOG_PATH, "w", encoding="utf-8") as fh:
        fh.write("\n".join(log_lines) + "\n")
    print(f"Wrote log -> {LOG_PATH}")

    print("\n--- Summary ---")
    for line in log_lines:
        print(line)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)