"""Load the ``my-db-config`` block and print its host to stdout."""

import os

# Match the setup script: keep the telemetry background service quiet
# so this short-lived script doesn't race with it on the SQLite file.
os.environ.setdefault("PREFECT_TELEMETRY_ENABLED", "false")

from custom_block import DatabaseConfig  # noqa: E402


def main() -> None:
    # ``load`` returns a typed instance of DatabaseConfig.
    config = DatabaseConfig.load("my-db-config")

    # Print only the host, as required by the task.
    print(config.host)


if __name__ == "__main__":
    main()