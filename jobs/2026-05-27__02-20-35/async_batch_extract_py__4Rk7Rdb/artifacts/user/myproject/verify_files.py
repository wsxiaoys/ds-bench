import os
import asyncio
from llama_cloud import AsyncLlamaCloud

async def main():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    client = AsyncLlamaCloud(api_key=api_key)
    
    # Just list some files to verify
    files = await client.files.list()
    for f in files:
        if f.external_file_id and "zr-4rk7rdb" in f.external_file_id:
            print(f.name, f.external_file_id)

if __name__ == "__main__":
    asyncio.run(main())
