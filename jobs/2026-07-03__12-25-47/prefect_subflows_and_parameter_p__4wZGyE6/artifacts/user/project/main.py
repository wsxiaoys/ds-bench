from prefect import flow


@flow(name="process_item")
def process_item(item: str, uppercase: bool) -> str:
    """Subflow that processes a single item string.

    If uppercase is True, returns the string uppercased; otherwise lowercased.
    """
    if uppercase:
        return item.upper()
    return item.lower()


@flow(name="main_flow")
def main_flow(items: list, uppercase: bool) -> list:
    """Parent flow that iterates over a list of items and processes each via the subflow."""
    results = []
    for item in items:
        processed = process_item(item, uppercase)
        results.append(processed)
    return results


if __name__ == "__main__":
    result = main_flow(items=["apple", "Banana", "cherry"], uppercase=True)
    print(result)
    with open("/home/user/project/output.log", "w") as f:
        f.write(str(result) + "\n")
