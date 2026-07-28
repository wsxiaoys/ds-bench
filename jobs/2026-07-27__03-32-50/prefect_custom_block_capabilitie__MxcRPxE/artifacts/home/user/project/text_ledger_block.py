"""Custom Prefect block that implements a tiny append-only text ledger."""

import hashlib
import os

from prefect.blocks.core import Block


class TextLedgerBlock(Block):
    """A tiny append-only text ledger stored on the local filesystem."""

    _block_type_name = "Text Ledger"

    storage_dir: str
    ledger_name: str
    hash_algorithm: str = "sha256"

    def _ledger_path(self) -> str:
        return os.path.join(self.storage_dir, f"{self.ledger_name}.log")

    def append_entry(self, text: str) -> str:
        path = self._ledger_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(text + "\n")

        hasher = hashlib.new(self.hash_algorithm)
        hasher.update(text.encode("utf-8"))
        return hasher.hexdigest()

    def entry_count(self) -> int:
        path = self._ledger_path()
        if not os.path.exists(path):
            return 0
        with open(path, "r", encoding="utf-8") as f:
            return sum(1 for line in f if line.strip() != "")
