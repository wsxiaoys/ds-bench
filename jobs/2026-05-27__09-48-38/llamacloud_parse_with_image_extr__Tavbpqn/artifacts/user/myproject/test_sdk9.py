from llama_cloud import LlamaCloud

client = LlamaCloud()
res = client.parsing.parse(
    upload_file=open("/home/user/myproject/input.pdf", "rb"),
    tier="agentic",
    version="latest",
    output_options={"images_to_save": ["screenshot"]},
    expand=["markdown", "images_content_metadata"]
)

for img in res.images_content_metadata.images:
    print(img.filename, img.category, getattr(img, 'page_number', None), getattr(img, 'index', None))
    print(img.presigned_url[:50] if img.presigned_url else None)
