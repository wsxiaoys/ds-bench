import os
import sys
import requests
import io
from PIL import Image
from llama_cloud import LlamaCloud, file_from_path

def main():
    print("Initializing LlamaCloud client...")
    client = LlamaCloud()
    
    input_path = "/home/user/myproject/input.pdf"
    output_dir = "/home/user/myproject/output"
    images_dir = os.path.join(output_dir, "images")
    
    # Create directories
    os.makedirs(images_dir, exist_ok=True)
    
    print(f"Uploading file {input_path}...")
    file_ref = file_from_path(input_path)
    file_obj = client.files.create(file=file_ref, purpose="parse")
    file_id = file_obj.id
    print(f"Uploaded file ID: {file_id}")
    
    print("Submitting parse job and waiting for completion...")
    result = client.parsing.parse(
        file_id=file_id,
        tier="cost_effective",
        version="latest",
        expand=["markdown", "images_content_metadata"],
        output_options={
            "images_to_save": ["screenshot"]
        },
        verbose=True
    )
    
    job_id = result.job.id if result.job else None
    print(f"Job completed. Job ID: {job_id}")
    
    # Process markdown
    markdown_pages = []
    if result.markdown and result.markdown.pages:
        for page in result.markdown.pages:
            if hasattr(page, 'markdown') and page.markdown is not None:
                markdown_pages.append(page.markdown)
            elif isinstance(page, dict) and 'markdown' in page:
                markdown_pages.append(page['markdown'])
                
    full_markdown = "\n\n".join(markdown_pages)
    markdown_path = os.path.join(output_dir, "markdown.md")
    with open(markdown_path, "w", encoding="utf-8") as f:
        f.write(full_markdown)
    
    markdown_chars = len(full_markdown)
    print(f"Saved markdown to {markdown_path} ({markdown_chars} characters)")
    
    # Process screenshot images
    image_count = 0
    if result.images_content_metadata and result.images_content_metadata.images:
        for img in result.images_content_metadata.images:
            if img.category == "screenshot":
                # Ensure we have a presigned url
                if not img.presigned_url:
                    print(f"Warning: No presigned URL for image index {img.index}")
                    continue
                
                print(f"Downloading screenshot index {img.index} from {img.presigned_url[:60]}...")
                resp = requests.get(img.presigned_url)
                if resp.status_code == 200:
                    # Parse 1-based page number. We can use index + 1
                    page_num = img.index + 1
                    img_path = os.path.join(images_dir, f"page_{page_num}.png")
                    
                    # Convert to PNG using PIL to ensure it is a valid PNG
                    try:
                        image = Image.open(io.BytesIO(resp.content))
                        image.save(img_path, "PNG")
                        print(f"Saved page {page_num} screenshot to {img_path}")
                        image_count += 1
                    except Exception as e:
                        print(f"Error converting image index {img.index} to PNG: {e}")
                else:
                    print(f"Failed to download image index {img.index}: HTTP {resp.status_code}")
                    
    # Write log file
    log_path = os.path.join(output_dir, "output.log")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"Parse job ID: {job_id}\n")
        f.write(f"Markdown chars: {markdown_chars}\n")
        f.write(f"Image count: {image_count}\n")
        
    print(f"Saved log to {log_path}")
    print("Done!")

if __name__ == "__main__":
    main()
