"""Prefect subflows and parameter passing example.

This script defines a subflow `process_item` and a parent flow `main_flow`.
The parent flow iterates over a list of strings, calling the subflow for each
item and passing an `uppercase` flag. The final result is written to a log file.
"""

from prefect import flow


@flow
def process_item(item: str, uppercase: bool) -> str:
    """Process a single string item.

    Args:
        item: The string to process.
        uppercase: If True the item is uppercased, otherwise it is lowercased.

    Returns:
        The processed string.
    """
    if uppercase:
        return item.upper()
    return item.lower()


@flow
def main_flow(items: list[str], uppercase: bool) -> list[str]:
    """Parent flow that calls the `process_item` subflow for every item.

    Args:
        items: List of strings to process.
        uppercase: Flag forwarded to every `process_item` subflow call.

    Returns:
        List of processed strings in the same order as the input.
    """
    processed: list[str] = []
    for item in items:
        processed.append(process_item(item, uppercase))
    return processed


if __name__ == "__main__":
    result = main_flow(items=["apple", "Banana", "cherry"], uppercase=True)

    log_path = "/home/user/project/output.log"
    with open(log_path, "w") as log_file:
        print(result, file=log_file)