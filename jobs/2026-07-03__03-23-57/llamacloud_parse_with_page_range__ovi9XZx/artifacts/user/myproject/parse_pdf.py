import os
import shutil
from llama_cloud import LlamaCloud, file_from_path

def main():
    # 1. Read API key
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")
    
    client = LlamaCloud(api_key=api_key)
    
    # 2. Upload file
    input_path = "/home/user/myproject/input/sample.pdf"
    print(f"Uploading file: {input_path}")
    file_obj = file_from_path(input_path)
    file_response = client.files.create(file=file_obj, purpose="parse")
    file_id = file_response.id
    print(f"Uploaded file. ID: {file_id}")
    
    # 3. Submit parse job
    print("Submitting parse job...")
    result = client.parsing.parse(
        tier="cost_effective",
        version="latest",
        file_id=file_id,
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"]
    )
    
    # 4. Extract job ID
    job_id = result.job.id
    print(f"Parse job completed. Job ID: {job_id}")
    
    # 5. Save per-page Markdown
    output_dir = "/home/user/myproject/output"
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    pages = result.markdown.pages if result.markdown else []
    pages_count = len(pages)
    print(f"Pages returned: {pages_count}")
    
    for page in pages:
        page_num = page.page_number
        md_content = page.markdown
        
        page_file = os.path.join(output_dir, f"page_{page_num}.md")
        with open(page_file, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"Saved page {page_num} to {page_file}")
        
    # 6. Write run summary log file
    log_job_id = job_id if job_id.startswith("pjb-") else f"pjb-{job_id}"
    
    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"Job ID: {log_job_id}\n")
        f.write(f"Pages parsed: {pages_count}\n")
    print(f"Log written to {log_path}")

if __name__ == "__main__":
    main()
