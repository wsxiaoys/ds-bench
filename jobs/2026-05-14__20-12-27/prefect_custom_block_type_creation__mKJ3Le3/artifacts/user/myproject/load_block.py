from custom_block import DatabaseConfig


def main():
    """
    Load the my-db-config block and print its host.
    """
    # Load the block by name using the Block.load class method
    db_config = DatabaseConfig.load("my-db-config")

    # Print the host to standard output
    print(db_config.host)


if __name__ == "__main__":
    main()