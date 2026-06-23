import os
import asyncio
from llama_cloud import AsyncLlamaCloud

async def main():
    print("Testing imports")
    from llama_cloud import FileInput
    print("FileInput imported successfully")

if __name__ == "__main__":
    asyncio.run(main())
