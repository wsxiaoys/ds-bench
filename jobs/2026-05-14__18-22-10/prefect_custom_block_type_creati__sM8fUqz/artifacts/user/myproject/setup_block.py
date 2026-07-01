from custom_block import DatabaseConfig

if __name__ == "__main__":
    block = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret"
    )
    block.save(name="my-db-config", overwrite=True)
    print("Block saved successfully.")
