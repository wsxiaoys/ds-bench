FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages prefect==3.0.0

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect task run concurrency limit task."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >flow.py <<'EOF'
import time
from prefect import flow, task

@task
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
EOF

# Container contents:
#   - prefect installed
#   - /home/user/project - Prefect project with flow.py
#   - flow.py with an initial un-tagged task

CMD ["/bin/bash", "-c", "prefect server start > /dev/null 2>&1 & sleep 5 && prefect config set PREFECT_API_URL=\"http://127.0.0.1:4200/api\" && trap : TERM INT; sleep infinity & wait"]
