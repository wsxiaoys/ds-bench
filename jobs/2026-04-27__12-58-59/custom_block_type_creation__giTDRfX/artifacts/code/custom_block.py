from prefect.blocks.core import Block
from pydantic import SecretStr

class DatabaseConfig(Block):
    host: str
    port: int = 5432
    password: SecretStr
