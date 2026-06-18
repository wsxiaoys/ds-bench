from custom_block import DatabaseConfig

def load():
    db_config = DatabaseConfig.load("my-db-config")
    print(db_config.host)

if __name__ == "__main__":
    load()
