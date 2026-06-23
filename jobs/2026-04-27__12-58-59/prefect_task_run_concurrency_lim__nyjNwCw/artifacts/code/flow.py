import time
from prefect import flow, task

@task(tags=["heavy-processing"])
def process_data(i):
    print(f"Processing data chunk {i}")
    time.sleep(1)
    return i * 2

@flow
def main_flow():
    for i in range(5):
        process_data.submit(i)

if __name__ == "__main__":
    main_flow()
