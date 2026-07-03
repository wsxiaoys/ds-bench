from prefect.blocks.core import Block
from pydantic import SecretStr


class DatabaseConfig(Block):
    """A custom block representing a database configuration."""

    host: str
    port: int = 5432
    password: SecretStr
