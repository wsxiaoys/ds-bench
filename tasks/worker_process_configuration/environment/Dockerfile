FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --ignore-installed prefect==3.6.28

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect project with an initial flow script in /home/user/myproject."

RUN mkdir -p /home/user/myproject/flows && \
    cd /home/user/myproject && \
    cat >flows/data_pipeline.py <<'EOF'
from prefect import flow

@flow(log_prints=True)
def my_flow():
    print("Hello from Prefect!")
EOF

# Container contents:
#   - prefect installed.
#   - /home/user/myproject/flows/data_pipeline.py - initial flow script.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
