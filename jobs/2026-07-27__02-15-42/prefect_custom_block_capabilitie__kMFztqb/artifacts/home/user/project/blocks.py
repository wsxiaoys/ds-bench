import os
import hashlib
from prefect.blocks.core import Block

class TextLedgerBlock(Block):
    _block_type_name = "Text Ledger"
    
    storage_dir: str
    ledger_name: str
    hash_algorithm: str = "sha256"
    
    def append_entry(self, text: str) -> str:
        os.makedirs(self.storage_dir, exist_ok=True)
        ledger_path = os.path.join(self.storage_dir, f"{self.ledger_name}.log")
        
        with open(ledger_path, "a", encoding="utf-8") as f:
            f.write(text + "\n")
            
        hasher = hashlib.new(self.hash_algorithm)
        hasher.update(text.encode("utf-8"))
        return hasher.hexdigest().lower()
        
    def entry_count(self) -> int:
        ledger_path = os.path.join(self.storage_dir, f"{self.ledger_name}.log")
        if not os.path.exists(ledger_path):
            return 0
        with open(ledger_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        return sum(1 for line in lines if line.strip() != "")
