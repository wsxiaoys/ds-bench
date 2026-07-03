from prefect import flow


@flow
def process_item(item: str, uppercase: bool) -> str:
    """Subflow that processes a single string item.

    If `uppercase` is True, returns the item uppercased;
    otherwise returns the item lowercased.
    """
    return item.upper() if uppercase else item.lower()


@flow
def main_flow(items: list, uppercase: bool) -> list:
    """Parent flow that iterates over a list of strings and calls the
    `process_item` subflow for each item, passing the `uppercase` flag.

    Returns the list of processed strings.
    """
    results = []
    for item in items:
        processed = process_item(item, uppercase)
        results.append(processed)
    return results


if __name__ == "__main__":
    LOG_FILE = "/home/user/project/output.log"
    result = main_flow(items=["apple", "Banana", "cherry"], uppercase=True)
    with open(LOG_FILE, "w") as f:
        f.write(str(result))