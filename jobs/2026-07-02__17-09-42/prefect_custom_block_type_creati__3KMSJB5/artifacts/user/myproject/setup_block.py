"""Register the custom DatabaseConfig block type and save a default instance.

This script:
1. Imports the custom block (which registers it with Prefect via the
   ``Block`` subclass registration mechanism).
2. Builds an instance of ``DatabaseConfig`` with the requested values.
3. Saves it to the local Prefect API under the name ``my-db-config``.

To avoid SQLite ``database is locked`` errors that can occur when the
background telemetry heartbeat service writes to the same local database
file, we disable the telemetry service for this short-lived script.
"""

import os

# Disable the Prefect telemetry background service before importing
# ``prefect`` so the setting is respected at server-spawn time.
os.environ.setdefault("PREFECT_TELEMETRY_ENABLED", "false")

from pydantic import SecretStr  # noqa: E402

from custom_block import DatabaseConfig  # noqa: E402

BLOCK_NAME = "my-db-config"


def main() -> None:
    # Construct the block in memory.
    config = DatabaseConfig(
        host="localhost",
        port=5432,
        password=SecretStr("supersecret"),
    )

    # Persist the block to the local Prefect SQLite-backed API.
    config.save(name=BLOCK_NAME, overwrite=True)

    print(f"Saved block: {BLOCK_NAME!r}")
    print(f"Block type:  {type(config).__name__}")
    print(f"Host:        {config.host}")
    print(f"Port:        {config.port}")


if __name__ == "__main__":
    main()