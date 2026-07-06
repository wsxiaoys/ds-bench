import time
from prefect import flow, task

@task
def do_nothing():
    pass

@flow(name="infinite_loop_flow", log_prints=True)
def infinite_loop_flow():
    print("Starting infinite loop flow...")
    while True:
        do_nothing()
        time.sleep(1)

if __name__ == "__main__":
    infinite_loop_flow()
