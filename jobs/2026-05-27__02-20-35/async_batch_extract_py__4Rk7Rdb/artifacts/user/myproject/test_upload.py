import os
import asyncio
from llama_cloud import AsyncLlamaCloud

async def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    client = AsyncLlamaCloud(api_key=api_key)
    with open("/home/user/myproject/data/invoice_a.pdf", "rb") as f:
        uploaded_file = await client.files.create(
            file=("invoice_a.pdf", f),
            purpose="extract",
            external_file_id="test-123"
        )
    print(uploaded_file.id)

if __name__ == "__main__":
    asyncio.run(main())
