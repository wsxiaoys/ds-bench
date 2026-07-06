import asyncio
from custom_block import DatabaseConfig


async def main():
    # Register the block type with the local Prefect instance
    await DatabaseConfig.register_type_and_schema()

    # Create and save an instance named "my-db-config"
    db_config = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret",
    )
    await db_config.save("my-db-config", overwrite=True)
    print("Block 'my-db-config' saved successfully.")


if __name__ == "__main__":
    asyncio.run(main())
