# Custom Prefect Block Type

## Background
Prefect Blocks are a primitive for configuring external systems and managing secrets. You can define custom block types by subclassing the `Block` base class.

## Requirements
- Create a Python file `/home/user/myproject/custom_block.py`.
- Define a custom Prefect Block named `DatabaseConfig` that inherits from `prefect.blocks.core.Block`.
- The block should have three fields: `host` (string), `port` (integer, default 5432), and `password` (string using `pydantic.SecretStr`).
- In the same script or a separate script `/home/user/myproject/setup_block.py`, register the block type to the local Prefect instance, and save an instance of it named `my-db-config` with host `localhost`, port `5432`, and password `supersecret`.
- Write a script `/home/user/myproject/load_block.py` that loads the `my-db-config` block and prints its host to standard output.

## Constraints
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- Start command: `python setup_block.py` (or execute the file where you do the setup)
- Ensure Prefect is installed and configured to use a local SQLite database (default behavior).

## Integrations
- None