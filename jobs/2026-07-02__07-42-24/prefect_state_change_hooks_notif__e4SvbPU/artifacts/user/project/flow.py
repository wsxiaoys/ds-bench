import os
# Configure Prefect to use a temporary database and home directory to avoid sqlite locking issues
os.environ["PREFECT_API_DATABASE_CONNECTION_URL"] = "sqlite+aiosqlite:////tmp/prefect.db"
os.environ["PREFECT_HOME"] = "/tmp/prefect"

from prefect import flow

def notify_success(flow, flow_run, state):
    with open("/home/user/project/success.log", "w") as f:
        f.write("Workflow succeeded")

def notify_failure(flow, flow_run, state):
    with open("/home/user/project/failure.log", "w") as f:
        f.write("Workflow failed")

@flow(name="data_pipeline", on_completion=[notify_success], on_failure=[notify_failure])
def data_pipeline(should_fail: bool):
    if should_fail:
        raise ValueError("Simulated failure")
    return "Success"

if __name__ == "__main__":
    data_pipeline(should_fail=False, return_state=True)
    data_pipeline(should_fail=True, return_state=True)
