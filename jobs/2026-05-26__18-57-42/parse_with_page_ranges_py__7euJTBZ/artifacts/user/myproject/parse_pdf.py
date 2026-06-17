import os
from llama_cloud import LlamaCloud

def main():
    # Initialize the client
    # It picks up LLAMA_CLOUD_API_KEY from environment automatically
    client = LlamaCloud()

    input_path = "/home/user/myproject/input/sample.pdf"
    output_dir = "/home/user/myproject/output"
    log_file = "/home/user/myproject/output.log"

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # 1. Upload the PDF
    print(f"Uploading {input_path}...")
    with open(input_path, "rb") as f:
        file_obj = client.files.create(file=f, purpose="parse")
    
    file_id = file_obj.id
    print(f"File uploaded. ID: {file_id}")

    # 2. Submit parse job
    print("Submitting parse job...")
    result = client.parsing.parse(
        file_id=file_id,
        tier="cost_effective",
        version="latest",
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"]
    )

    job_id = result.job.id
    print(f"Job submitted. ID: {job_id}")

    # 3. Process results
    pages = result.markdown.pages
    num_pages = len(pages)
    print(f"Received {num_pages} pages.")

    for page in pages:
        page_num = page.page_number
        markdown_content = page.markdown
        output_path = os.path.join(output_dir, f"page_{page_num}.md")
        with open(output_path, "w") as f:
            f.write(markdown_content)
        print(f"Saved page {page_num} to {output_path}")

    # 4. Write summary log
    with open(log_file, "w") as f:
        f.write(f"Job ID: {job_id}\n")
        f.write(f"Pages parsed: {num_pages}\n")
    print(f"Log written to {log_file}")

if __name__ == "__main__":
    main()
