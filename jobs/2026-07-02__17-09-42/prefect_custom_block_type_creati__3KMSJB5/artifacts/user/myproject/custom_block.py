"""Custom Prefect Block type for database configuration."""

from pydantic import SecretStr
from prefect.blocks.core import Block


class DatabaseConfig(Block):
    """A Prefect Block that stores database connection configuration.

    Attributes:
        host: The database host.
        port: The database port (defaults to 5432).
        password: The database password, stored as a secret string.
    """

    host: str
    port: int = 5432
    password: SecretStr

    # Display metadata shown in the Prefect UI for this block type.
    _block_type_name = "Database Config"
    _logo_url = "https://images.ctfassets.net/gm98wzqotmnx/2IfwofbalDYIykVcWNg6Vi/ae1d8aaece81aa6f4d8b4a4ad77b8d0c/image.png?w=64&h=64"
    _documentation_url = "https://prefect.io/docs"


if __name__ == "__main__":
    # Quick sanity check: print the block schema.
    print(DatabaseConfig.schema_json(indent=2))