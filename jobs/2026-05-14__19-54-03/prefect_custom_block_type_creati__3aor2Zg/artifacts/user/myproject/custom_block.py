from prefect.blocks.core import Block
from pydantic import SecretStr


class DatabaseConfig(Block):
    """A custom Prefect Block for storing database connection configuration."""

    host: str
    port: int = 5432
    password: SecretStr
