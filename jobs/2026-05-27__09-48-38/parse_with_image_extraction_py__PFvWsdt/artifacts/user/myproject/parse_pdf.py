import os
import requests
from llama_cloud import LlamaCloud

def main():
    client = LlamaCloud()
    input_path = "/home/user/myproject/input.pdf"
    output_dir = "/home/user/myproject/output"
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    print(f"Starting parse for {input_path}...")
    
    with open(input_path, "rb") as f:
        # According to hints:
        # configure output_options.images_to_save and include the appropriate expand entries
        # Use a non-deprecated parse tier (e.g. "agentic")
        result = client.parsing.parse(
            upload_file=f,
            tier="agentic",
            version="latest",
            output_options={
                "images_to_save": ["screenshot"]
            },
            expand=["markdown", "images_content_metadata"]
        )

    job_id = result.job.id if hasattr(result, 'job') and result.job else "unknown"
    print(f"Parse job completed. ID: {job_id}")

    # Process Markdown
    # Hint: "The markdown response object exposes the parsed pages — concatenate the per-page markdown content (separated by blank lines)"
    # Depending on the SDK version, result.markdown might have a .pages attribute or be the content.
    # If expand=["markdown"] is used, result.markdown is often a list of MarkdownPage objects or similar.
    
    markdown_text = ""
    if hasattr(result, 'markdown') and result.markdown:
        if hasattr(result.markdown, 'pages'):
            markdown_text = "\n\n".join([page.markdown for page in result.markdown.pages])
        elif isinstance(result.markdown, list):
            markdown_text = "\n\n".join([page.markdown for page in result.markdown])
        else:
            markdown_text = str(result.markdown)
    
    markdown_path = os.path.join(output_dir, "markdown.md")
    with open(markdown_path, "w") as f:
        f.write(markdown_text)
    
    markdown_len = len(markdown_text)
    print(f"Markdown saved to {markdown_path} ({markdown_len} chars)")

    # Process Images
    # Hint: "The image content metadata returned by the SDK contains downloadable references for each screenshot"
    # result.images_content_metadata
    
    image_count = 0
    if hasattr(result, 'images_content_metadata') and result.images_content_metadata:
        items = []
        if hasattr(result.images_content_metadata, 'images'):
            items = result.images_content_metadata.images
        elif isinstance(result.images_content_metadata, list):
            items = result.images_content_metadata
        
        from PIL import Image
        import io

        for idx, img_metadata in enumerate(items):
            # Page screenshots are usually identified by their type or naming
            # The hint says: Name each file page_<N>.png where <N> is the 1-based page number
            
            # Use index if page_number is not available, but usually it's idx + 1
            page_num = idx + 1
            if hasattr(img_metadata, 'page_number') and img_metadata.page_number:
                page_num = img_metadata.page_number
            
            # Check for download URL
            download_url = None
            for attr in ['presigned_url', 'download_url', 'url']:
                if hasattr(img_metadata, attr):
                    download_url = getattr(img_metadata, attr)
                    if download_url:
                        break
            
            if download_url:
                resp = requests.get(download_url)
                if resp.status_code == 200:
                    img_path = os.path.join(images_dir, f"page_{page_num}.png")
                    # Convert to PNG to ensure it meets requirements
                    img = Image.open(io.BytesIO(resp.content))
                    img.save(img_path, "PNG")
                    image_count += 1
                    print(f"Saved image: {img_path}")
                else:
                    print(f"Failed to download image from {download_url}, status: {resp.status_code}")
            else:
                print(f"No download URL found for image {idx}")

    # Write Log File
    log_path = os.path.join(output_dir, "output.log")
    with open(log_path, "w") as f:
        f.write(f"Parse job ID: {job_id}\n")
        f.write(f"Markdown chars: {markdown_len}\n")
        f.write(f"Image count: {image_count}\n")
    
    print(f"Log written to {log_path}")

if __name__ == "__main__":
    main()
