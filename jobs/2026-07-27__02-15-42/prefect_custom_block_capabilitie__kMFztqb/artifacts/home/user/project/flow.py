import os
import json
import sys
from prefect import flow

# Add current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from blocks import TextLedgerBlock

@flow(name="build_ledger")
def build_ledger():
    # Load the saved block document back from the server
    block = TextLedgerBlock.load("primary")
    
    # Append entries
    entries_to_append = ["alpha", "beta", "gamma"]
    entries_summary = []
    
    for text in entries_to_append:
        digest = block.append_entry(text)
        entries_summary.append({
            "text": text,
            "digest": digest
        })
        
    # Get entry count
    final_count = block.entry_count()
    
    # Prepare summary data
    summary_data = {
        "ledger_name": block.ledger_name,
        "hash_algorithm": block.hash_algorithm,
        "entry_count": final_count,
        "entries": entries_summary
    }
    
    summary_path = os.path.join(block.storage_dir, "summary.json")
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=4)
        
    print("Flow completed and summary.json written.")

if __name__ == "__main__":
    build_ledger()
