import os
import httpx
from io import BytesIO
from PIL import Image
from llama_cloud import LlamaCloud

def main():
    client = LlamaCloud()
    
    input_path = "/home/user/myproject/input.pdf"
    
    print("Parsing document...")
    res = client.parsing.parse(
        upload_file=open(input_path, "rb"),
        tier="agentic",
        version="latest",
        output_options={"images_to_save": ["screenshot"]},
        expand=["markdown", "images_content_metadata"]
    )
    
    job_id = res.job.id
    print(f"Job ID: {job_id}")
    
    # Create directories
    output_dir = "/home/user/myproject/output"
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # Save markdown
    markdown_path = os.path.join(output_dir, "markdown.md")
    markdown_text = ""
    if res.markdown and res.markdown.pages:
        markdown_text = "\n\n".join([page.markdown for page in res.markdown.pages if page.markdown])
    
    with open(markdown_path, "w", encoding="utf-8") as f:
        f.write(markdown_text)
    
    markdown_chars = len(markdown_text)
    print(f"Markdown chars: {markdown_chars}")
    
    # Save images
    image_count = 0
    if res.images_content_metadata and res.images_content_metadata.images:
        for img_meta in res.images_content_metadata.images:
            if img_meta.category == "screenshot":
                # filename is like page_1.jpg
                # we need to extract the page number to name it page_<N>.png
                # or just use the index + 1
                page_num = img_meta.index + 1
                
                url = img_meta.presigned_url
                if url:
                    img_resp = httpx.get(url)
                    img_resp.raise_for_status()
                    
                    # Convert to PNG
                    img = Image.open(BytesIO(img_resp.content))
                    png_path = os.path.join(images_dir, f"page_{page_num}.png")
                    img.save(png_path, "PNG")
                    image_count += 1
    
    print(f"Image count: {image_count}")
    
    # Write log
    log_path = os.path.join(output_dir, "output.log")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"Parse job ID: {job_id}\n")
        f.write(f"Markdown chars: {markdown_chars}\n")
        f.write(f"Image count: {image_count}\n")

if __name__ == "__main__":
    main()
