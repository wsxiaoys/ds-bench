from llama_cloud import LlamaCloud

client = LlamaCloud()
res = client.parsing.parse(
    upload_file=open("/home/user/myproject/input.pdf", "rb"),
    tier="agentic",
    version="latest",
    output_options={"images_to_save": ["screenshot"]},
    expand=["markdown", "images_content_metadata"]
)

print("Job ID:", res.job.id)
print("Has markdown:", res.markdown is not None)
if res.markdown:
    print("Markdown pages:", len(res.markdown.pages))
    print("Type of pages:", type(res.markdown.pages[0]))
    print("Attributes of page:", dir(res.markdown.pages[0]))
print("Has images_content_metadata:", res.images_content_metadata is not None)
if res.images_content_metadata:
    print("Image content metadata items:", len(res.images_content_metadata))
    if len(res.images_content_metadata) > 0:
        print("First item attributes:", dir(res.images_content_metadata[0]))
        print("Type:", res.images_content_metadata[0].type)
        print("Page:", getattr(res.images_content_metadata[0], 'page', None))
        print("URL:", getattr(res.images_content_metadata[0], 'url', None))
