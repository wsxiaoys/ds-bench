FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash sqlite3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --ignore-installed prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect environment with a long-running flow script in /home/user/project/flow.py."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >flow.py <<'EOF'
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
EOF

# Container contents:
#   - prefect installed
#   - /home/user/project  — project directory with flow.py

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
