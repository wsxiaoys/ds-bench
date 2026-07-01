from prefect.blocks.core import Block
from pydantic import SecretStr, Field


class DatabaseConfig(Block):
    """
    A custom Prefect block for database configuration.
    """
    host: str = Field(description="Database host address")
    port: int = Field(default=5432, description="Database port number")
    password: SecretStr = Field(description="Database password")

    _block_type_name = "DatabaseConfig"
    _logo_url = None

    class Config:
        json_schema_extra = {
            "example": {
                "host": "localhost",
                "port": 5432,
                "password": "supersecret"
            }
        }