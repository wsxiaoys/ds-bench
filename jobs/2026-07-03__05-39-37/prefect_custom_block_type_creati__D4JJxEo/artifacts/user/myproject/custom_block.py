"""Custom Prefect Block type for database configuration.

Defines a ``DatabaseConfig`` block that stores connection parameters for a
database, including a secret password.
"""

from prefect.blocks.core import Block
from pydantic import SecretStr


class DatabaseConfig(Block):
    """Configuration block for a database connection.

    Attributes:
        host: The database host address.
        port: The port the database is listening on (default 5432).
        password: The password used to authenticate with the database.
    """

    _block_type_name = "Database Config"
    _block_type_slug = "database-config"
    _description = "Stores database connection configuration."

    host: str
    port: int = 5432
    password: SecretStr