"""Register the TextLedgerBlock block type and save the 'primary' instance."""

from text_ledger_block import TextLedgerBlock


def main():
    TextLedgerBlock.register_type_and_schema()

    block = TextLedgerBlock(
        storage_dir="/home/user/project/ledger_store",
        ledger_name="events",
        hash_algorithm="sha256",
    )
    block.save("primary", overwrite=True)
    print("Registered block type 'text-ledger' and saved document 'primary'.")


if __name__ == "__main__":
    main()
