import sys
import os

# Ensure the block can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from custom_block import DatabaseConfig

def main():
    # Register the block type
    print("Registering DatabaseConfig block type...")
    DatabaseConfig.register_type_and_schema()
    
    # Save an instance of the block
    print("Saving my-db-config block instance...")
    db_config = DatabaseConfig(
        host="localhost",
        port=5432,
        password="supersecret"
    )
    db_config.save(name="my-db-config", overwrite=True)
    print("Block registered and saved successfully!")

if __name__ == "__main__":
    main()
