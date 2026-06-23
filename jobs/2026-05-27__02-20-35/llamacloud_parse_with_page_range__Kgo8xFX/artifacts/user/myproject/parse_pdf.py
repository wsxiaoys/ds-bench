import os
from llama_cloud import LlamaCloud

def main():
    client = LlamaCloud()
    
    with open("/home/user/myproject/input/sample.pdf", "rb") as f:
        file_obj = client.files.create(file=f, purpose="parse")
    
    result = client.parsing.parse(
        file_id=file_obj.id,
        tier="cost_effective",
        version="latest",
        page_ranges={"target_pages": "1-2"},
        expand=["markdown"]
    )
    
    for page in result.markdown.pages:
        with open(f"/home/user/myproject/output/page_{page.page_number}.md", "w") as out_f:
            out_f.write(page.markdown)
            
    with open("/home/user/myproject/output.log", "w") as log_f:
        log_f.write(f"Job ID: {result.job.id}\n")
        log_f.write(f"Pages parsed: {len(result.markdown.pages)}\n")

if __name__ == "__main__":
    main()
