from prefect import flow

@flow(log_prints=True)
def routing_flow(name: str):
    print(f"Flow run for {name} completed successfully.")

if __name__ == "__main__":
    routing_flow("local-test")
