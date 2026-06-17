from custom_block import DatabaseConfig
import asyncio

async def setup():
    # Saving the block instance
    db_config = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret"
    )
    # save() is an async method in Prefect 3.x for some contexts, 
    # but Block.save is actually sync or async depending on version.
    # In Prefect 2.x/3.x, Block.save is usually sync but can be used in async.
    # Actually, Block.save is sync in the Python SDK.
    
    db_config.save("my-db-config", overwrite=True)
    print("Block 'my-db-config' saved successfully.")

if __name__ == "__main__":
    import asyncio
    # Prefect 3.x might prefer async for some operations, but Block.save is sync.
    # Let's keep it simple.
    setup_result = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret"
    ).save("my-db-config", overwrite=True)
    print("Block 'my-db-config' saved successfully.")
