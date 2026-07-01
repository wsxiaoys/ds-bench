import asyncio
from custom_block import DatabaseConfig


async def main():
    db_config = await DatabaseConfig.load("my-db-config")
    print(db_config.host)


if __name__ == "__main__":
    asyncio.run(main())
