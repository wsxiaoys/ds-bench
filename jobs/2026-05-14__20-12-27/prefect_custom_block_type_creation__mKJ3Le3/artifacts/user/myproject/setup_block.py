from custom_block import DatabaseConfig


def main():
    """
    Register the DatabaseConfig block type and save an instance.
    """
    # Create an instance of DatabaseConfig
    db_config = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret"
    )

    # Save the block to the local Prefect instance
    # This registers the block type and saves the instance
    db_config.save("my-db-config", overwrite=True)

    print(f"Successfully registered DatabaseConfig block type")
    print(f"Saved block instance 'my-db-config' with host='{db_config.host}', port={db_config.port}")


if __name__ == "__main__":
    main()