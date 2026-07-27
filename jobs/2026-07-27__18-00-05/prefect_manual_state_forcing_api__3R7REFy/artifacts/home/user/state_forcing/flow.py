import os
import time
from prefect import flow, task

RUN_ID = "zr8d3l232h"
FLOW_NAME = f"state-forcing-flow-{RUN_ID}"


@task
def do_work():
    time.sleep(5)
    return "work done"


@flow(name=FLOW_NAME)
def state_forcing_flow():
    result = do_work()
    return result
