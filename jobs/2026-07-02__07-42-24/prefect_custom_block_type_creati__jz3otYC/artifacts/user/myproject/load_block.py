import sys
import os

# Ensure the block can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from custom_block import DatabaseConfig

def main():
    # Load the block
    db_config = DatabaseConfig.load("my-db-config")
    # Print its host to standard output
    print(db_config.host)

if __name__ == "__main__":
    main()
