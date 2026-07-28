"""Flow that loads the saved TextLedgerBlock and drives its methods."""

import json

from prefect import flow

from text_ledger_block import TextLedgerBlock

SUMMARY_PATH = "/home/user/project/ledger_store/summary.json"


@flow(name="build_ledger")
def build_ledger():
    block = TextLedgerBlock.load("primary")

    entries = []
    for text in ("alpha", "beta", "gamma"):
        digest = block.append_entry(text)
        entries.append({"text": text, "digest": digest})

    summary = {
        "ledger_name": block.ledger_name,
        "hash_algorithm": block.hash_algorithm,
        "entry_count": block.entry_count(),
        "entries": entries,
    }

    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary


if __name__ == "__main__":
    build_ledger()
