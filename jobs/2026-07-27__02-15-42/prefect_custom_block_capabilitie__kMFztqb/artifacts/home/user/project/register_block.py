import sys
import os

# Add current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from blocks import TextLedgerBlock

def main():
    print("Registering block type...")
    TextLedgerBlock.register_type_and_schema()
    print("Block type registered.")
    
    print("Saving primary block document...")
    block = TextLedgerBlock(
        storage_dir="/home/user/project/ledger_store",
        ledger_name="events",
        hash_algorithm="sha256"
    )
    block.save("primary", overwrite=True)
    print("Block document saved.")

if __name__ == "__main__":
    main()
