#!/usr/bin/env python3
"""
Parse a PDF using LlamaCloud Parse v2 with page ranges and cost-effective tier.
"""

import os
from pathlib import Path
from llama_cloud import LlamaCloud

# Configuration
PDF_PATH = "/home/user/myproject/input/sample.pdf"
OUTPUT_DIR = "/home/user/myproject/output"
LOG_FILE = "/home/user/myproject/output.log"

def main():
    """Main function to parse PDF and save results."""
    
    # Initialize LlamaCloud client (automatically picks up LLAMA_CLOUD_API_KEY)
    client = LlamaCloud()
    
    print(f"Uploading PDF: {PDF_PATH}")
    
    # Upload the PDF with purpose="parse"
    with open(PDF_PATH, "rb") as f:
        file_response = client.files.create(file=f, purpose="parse")
    
    file_id = file_response.id
    print(f"File uploaded successfully. File ID: {file_id}")
    
    # Submit parse job with cost_effective tier, latest version, and page ranges
    print("Submitting parse job...")
    result = client.parsing.parse(
        file_id=file_id,
        tier="cost_effective",
        version="latest",
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"]
    )
    
    # Extract job ID
    job_id = result.job.id
    print(f"Parse job submitted. Job ID: {job_id}")
    
    # Create output directory if it doesn't exist
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    # Save per-page markdown files
    pages = result.markdown.pages
    page_count = len(pages)
    print(f"Received {page_count} pages with markdown content")
    
    for page in pages:
        page_number = page.page_number
        markdown_content = page.markdown
        
        output_file = Path(OUTPUT_DIR) / f"page_{page_number}.md"
        output_file.write_text(markdown_content, encoding="utf-8")
        print(f"Saved: {output_file}")
    
    # Write log file with job ID and page count
    log_content = f"Job ID: {job_id}\nPages parsed: {page_count}\n"
    Path(LOG_FILE).write_text(log_content, encoding="utf-8")
    print(f"Log file saved: {LOG_FILE}")
    
    print("\n✓ Parse completed successfully!")
    print(f"  - Job ID: {job_id}")
    print(f"  - Pages parsed: {page_count}")
    print(f"  - Output directory: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()