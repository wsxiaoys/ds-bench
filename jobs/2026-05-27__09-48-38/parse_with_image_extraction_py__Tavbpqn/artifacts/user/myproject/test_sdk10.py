from llama_cloud import LlamaCloud

client = LlamaCloud()
res = client.parsing.parse(
    upload_file=open("/home/user/myproject/input.pdf", "rb"),
    tier="agentic",
    version="latest",
    output_options={"images_to_save": ["screenshot"]},
    expand=["markdown", "images_content_metadata"]
)

for p in res.markdown.pages:
    print(p.page_number, len(p.markdown))
