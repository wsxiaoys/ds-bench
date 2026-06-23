from llama_cloud import LlamaCloud

client = LlamaCloud()
res = client.parsing.parse(
    upload_file=open("/home/user/myproject/input.pdf", "rb"),
    tier="agentic",
    version="latest",
    output_options={"images_to_save": ["screenshot"]},
    expand=["markdown", "images_content_metadata"]
)

print("Type of images_content_metadata:", type(res.images_content_metadata))
print("Attributes:", dir(res.images_content_metadata))
if hasattr(res.images_content_metadata, 'images'):
    print("Has images, type:", type(res.images_content_metadata.images))
    print("Len images:", len(res.images_content_metadata.images))
    if len(res.images_content_metadata.images) > 0:
        print("First image attributes:", dir(res.images_content_metadata.images[0]))
        print("First image type:", res.images_content_metadata.images[0].type)
        print("First image page:", res.images_content_metadata.images[0].page_number)
        print("First image URL:", res.images_content_metadata.images[0].url)
