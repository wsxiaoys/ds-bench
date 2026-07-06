from prefect import flow

@flow
def process_item(item: str, uppercase: bool) -> str:
    if uppercase:
        return item.upper()
    else:
        return item.lower()

@flow
def main_flow(items: list, uppercase: bool) -> list:
    processed_items = []
    for item in items:
        res = process_item(item, uppercase)
        processed_items.append(res)
    return processed_items

if __name__ == "__main__":
    result = main_flow(items=["apple", "Banana", "cherry"], uppercase=True)
    with open("/home/user/project/output.log", "w") as f:
        f.write(str(result) + "\n")
