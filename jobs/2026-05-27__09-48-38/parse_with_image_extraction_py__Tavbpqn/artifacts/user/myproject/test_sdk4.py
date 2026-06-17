from llama_cloud import LlamaCloud

client = LlamaCloud()
res = client.parsing.parse(
    upload_file=open("/home/user/myproject/input.pdf", "rb"),
    tier="fast",
    version="latest",
    output_options={"images_to_save": ["screenshot"]},
    expand=["markdown", "images_content_metadata"]
)

print("Job ID:", res.id)
print("Has markdown:", res.markdown is not None)
if res.markdown:
    print("Markdown pages:", len(res.markdown.pages))
print("Has images_content_metadata:", res.images_content_metadata is not None)
if res.images_content_metadata:
    print("Image content metadata items:", len(res.images_content_metadata))
    if len(res.images_content_metadata) > 0:
        print("First item attributes:", dir(res.images_content_metadata[0]))
        print("URL:", res.images_content_metadata[0].url)
