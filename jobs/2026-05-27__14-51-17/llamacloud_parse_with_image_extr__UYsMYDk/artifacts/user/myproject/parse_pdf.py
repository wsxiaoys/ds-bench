#!/usr/bin/env python3
"""Parse a PDF using LlamaCloud and extract markdown and per-page screenshots."""

import os
import logging
from pathlib import Path
from llama_cloud import LlamaCloud

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    # Paths
    input_pdf_path = Path("/home/user/myproject/input.pdf")
    output_dir = Path("/home/user/myproject/output")
    images_dir = output_dir / "images"
    markdown_path = output_dir / "markdown.md"
    log_path = output_dir / "output.log"

    # Create output directories
    images_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Initialize LlamaCloud client (reads LLAMA_CLOUD_API_KEY from environment)
    client = LlamaCloud()

    logger.info(f"Uploading PDF: {input_pdf_path}")

    # Upload the PDF file
    with open(input_pdf_path, "rb") as f:
        file_response = client.files.create(
            file=f,
            purpose="parse"
        )
    
    file_id = file_response.id
    logger.info(f"File uploaded with ID: {file_id}")

    # Submit parse job with per-page screenshots and markdown
    logger.info("Submitting parse job...")
    parse_result = client.parsing.parse(
        tier="agentic",
        version="latest",
        file_id=file_id,
        output_options={
            "images_to_save": ["screenshot"]
        },
        expand=["markdown", "images_content_metadata"]
    )

    job_id = parse_result.job_id
    logger.info(f"Parse job ID: {job_id}")

    # Extract markdown content
    markdown_content = ""
    if parse_result.markdown and parse_result.markdown.pages:
        # Concatenate per-page markdown content separated by blank lines
        markdown_pages = []
        for page in parse_result.markdown.pages:
            if page.content:
                markdown_pages.append(page.content)
        markdown_content = "\n\n".join(markdown_pages)

    # Save markdown to disk
    with open(markdown_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
    
    markdown_chars = len(markdown_content)
    logger.info(f"Markdown saved: {markdown_chars} characters")

    # Extract and save per-page screenshots
    image_count = 0
    if parse_result.image_content_metadata:
        for image_meta in parse_result.image_content_metadata:
            # Check if this is a page screenshot
            if hasattr(image_meta, 'image_type') and image_meta.image_type == 'page_screenshot':
                image_count += 1
                # Get image bytes
                image_bytes = client.files.content(image_meta.image_file_id).content
                
                # Save to disk
                page_num = image_count  # 1-based page numbering
                image_path = images_dir / f"page_{page_num}.png"
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                
                logger.info(f"Saved page screenshot: {image_path}")
            elif hasattr(image_meta, 'image_type') and image_meta.image_type == 'page':
                # Alternative: some versions might use 'page' type
                image_count += 1
                image_bytes = client.files.content(image_meta.image_file_id).content
                page_num = image_count
                image_path = images_dir / f"page_{page_num}.png"
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                logger.info(f"Saved page screenshot: {image_path}")

    logger.info(f"Total screenshots saved: {image_count}")

    # Write log file
    log_entries = [
        f"Parse job ID: {job_id}",
        f"Markdown chars: {markdown_chars}",
        f"Image count: {image_count}"
    ]
    
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("\n".join(log_entries) + "\n")
    
    logger.info(f"Log file written: {log_path}")
    logger.info("Parse job completed successfully!")

if __name__ == "__main__":
    main()