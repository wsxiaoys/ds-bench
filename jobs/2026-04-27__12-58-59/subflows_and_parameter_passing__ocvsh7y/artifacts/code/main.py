from prefect import flow

@flow
def process_item(item: str, uppercase: bool):
    """
    Subflow to process a single item.
    """
    if uppercase:
        return item.upper()
    else:
        return item.lower()

@flow
def main_flow(items: list[str], uppercase: bool):
    """
    Parent flow that iterates over items and calls the subflow.
    """
    results = []
    for item in items:
        # Calling process_item as a subflow
        processed = process_item(item=item, uppercase=uppercase)
        results.append(processed)
    return results

if __name__ == "__main__":
    items_to_process = ["apple", "Banana", "cherry"]
    should_uppercase = True
    
    # Execute the main flow
    final_results = main_flow(items=items_to_process, uppercase=should_uppercase)
    
    # Write result to output.log
    output_path = "/home/user/project/output.log"
    with open(output_path, "w") as f:
        f.write(str(final_results))
    
    print(f"Results: {final_results}")
