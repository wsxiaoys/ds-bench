"""Register the ``DatabaseConfig`` block type and save a named instance.

This script registers the custom block type with the local Prefect instance
and then saves a block instance named ``my-db-config`` for later retrieval.
"""

from custom_block import DatabaseConfig


def main() -> None:
    # Register the custom block type and its schema with the Prefect API.
    DatabaseConfig.register_type_and_schema()

    # Create an instance with the desired configuration.
    db_config = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret",
    )

    # Persist the instance under the name "my-db-config".
    db_config.save(name="my-db-config", overwrite=True)

    print("Registered 'Database Config' block type.")
    print("Saved block instance 'my-db-config'.")


if __name__ == "__main__":
    main()