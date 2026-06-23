from prefect import flow, task
from prefect.flow_runs import pause_flow_run

@task
def task_one():
    print("Task 1 complete")

@task
def task_two():
    print("Task 2 complete")

@flow(name="my_pausing_flow")
def my_pausing_flow():
    task_one()
    pause_flow_run(timeout=3600)
    task_two()

if __name__ == "__main__":
    my_pausing_flow()
