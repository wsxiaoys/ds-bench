from custom_block import DatabaseConfig

if __name__ == "__main__":
    block = DatabaseConfig.load("my-db-config")
    print(block.host)
