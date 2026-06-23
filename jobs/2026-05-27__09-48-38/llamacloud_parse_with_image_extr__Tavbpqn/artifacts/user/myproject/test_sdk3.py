from llama_cloud import LlamaCloud

client = LlamaCloud()
res = client.parsing.parse(
    upload_file=open("/home/user/myproject/input.pdf", "rb"),
    tier="fast",
    version="latest",
    output_options={"images_to_save": ["screenshot"]},
    expand=["markdown", "image_content_metadata"]
)

print("Job ID:", res.id)
print("Has markdown:", hasattr(res, 'markdown') or 'markdown' in dir(res))
if res.markdown:
    print("Markdown pages:", len(res.markdown.pages))
if hasattr(res, 'image_content_metadata'):
    print("Has image_content_metadata:", res.image_content_metadata is not None)
    if res.image_content_metadata:
        print("Image content metadata items:", len(res.image_content_metadata))
        print("First item keys:", dir(res.image_content_metadata[0]))
