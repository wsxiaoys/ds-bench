from custom_block import DatabaseConfig

if __name__ == "__main__":
    # Register the custom block type with Prefect
    DatabaseConfig.register_type_and_schema()

    # Create an instance and save it to the local Prefect instance
    block = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret",
    )
    block.save(name="my-db-config", overwrite=True)
    print(f"Saved block with name: my-db-config")
