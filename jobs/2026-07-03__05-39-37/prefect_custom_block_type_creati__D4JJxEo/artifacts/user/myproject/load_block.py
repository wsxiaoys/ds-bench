"""Load the saved ``my-db-config`` block and print its host."""

from custom_block import DatabaseConfig


def main() -> None:
    # Load the previously saved block instance by name.
    db_config = DatabaseConfig.load("my-db-config")

    # Print the host to standard output.
    print(db_config.host)


if __name__ == "__main__":
    main()