"""Parse a PDF with LlamaParse and save per-page screenshots + markdown."""

import io
import os
import sys
from pathlib import Path

import httpx
from PIL import Image

from llama_cloud import LlamaCloud, file_from_path

INPUT_PDF = Path("/home/user/myproject/input.pdf")
OUTPUT_DIR = Path("/home/user/myproject/output")
IMAGES_DIR = OUTPUT_DIR / "images"
MARKDOWN_PATH = OUTPUT_DIR / "markdown.md"
LOG_PATH = OUTPUT_DIR / "output.log"


def main() -> int:
    # Ensure output directories exist.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    if not INPUT_PDF.is_file():
        print(f"Input PDF not found: {INPUT_PDF}", file=sys.stderr)
        return 1

    # Initialize the LlamaCloud client (reads LLAMA_CLOUD_API_KEY from env).
    client = LlamaCloud()

    # Step 1: upload the PDF as a parse source file.
    uploaded = client.files.create(
        file=file_from_path(str(INPUT_PDF)),
        purpose="parse",
    )
    file_id = uploaded.id
    print(f"Uploaded file id: {file_id}")

    # Step 2: submit a parse job requesting per-page screenshots + markdown.
    result = client.parsing.parse(
        tier="agentic",
        version="latest",
        file_id=file_id,
        expand=["markdown", "images_content_metadata"],
        output_options={
            "images_to_save": ["screenshot"],
        },
    )

    job_id = result.job.id
    print(f"Parse job id: {job_id} (status: {result.job.status})")

    # Step 3: write the markdown file (per-page markdown joined by blank lines).
    markdown_pages = []
    if result.markdown and result.markdown.pages:
        for page in result.markdown.pages:
            if getattr(page, "success", True):
                markdown_pages.append(f"# Page {page.page_number}\n\n{page.markdown}".rstrip())
            else:
                markdown_pages.append(
                    f"# Page {page.page_number}\n\n_[parse failed: {getattr(page, 'error', '')}]_"
                )
    markdown_text = "\n\n".join(markdown_pages)
    markdown_text += "\n"
    MARKDOWN_PATH.write_text(markdown_text, encoding="utf-8")
    markdown_chars = len(markdown_text)
    print(f"Wrote markdown ({markdown_chars} chars) to {MARKDOWN_PATH}")

    # Step 4: download per-page screenshots and write them as page_<N>.png.
    image_count = 0
    if result.images_content_metadata and result.images_content_metadata.images:
        # Filter to screenshot category to be safe.
        screenshots = [
            img for img in result.images_content_metadata.images
            if getattr(img, "category", None) == "screenshot"
        ]
        if not screenshots:
            screenshots = result.images_content_metadata.images

        # Sort by index to maintain page order (screenshot N -> page N+1
        # when only screenshots are requested).
        screenshots.sort(key=lambda i: i.index)

        with httpx.Client(timeout=120.0) as http:
            for img in screenshots:
                page_num = img.index + 1  # 0-based index -> 1-based page number
                url = img.presigned_url
                if not url:
                    print(f"  ! no presigned_url for image index={img.index}, skipping")
                    continue
                resp = http.get(url)
                resp.raise_for_status()
                # Parse endpoint serves screenshots as JPEG; convert to PNG
                # so the saved `page_<N>.png` is a valid PNG image file.
                with Image.open(io.BytesIO(resp.content)) as im:
                    buf = io.BytesIO()
                    im.save(buf, format="PNG")
                    png_bytes = buf.getvalue()
                out_path = IMAGES_DIR / f"page_{page_num}.png"
                out_path.write_bytes(png_bytes)
                image_count += 1
                print(f"  wrote {out_path} ({len(png_bytes)} bytes)")

    print(f"Wrote {image_count} screenshot(s) to {IMAGES_DIR}")

    # Step 5: write the log file with the required entries.
    LOG_PATH.write_text(
        "\n".join(
            [
                f"Parse job ID: {job_id}",
                f"Markdown chars: {markdown_chars}",
                f"Image count: {image_count}",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"Wrote log to {LOG_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
