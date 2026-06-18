FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --ignore-installed pluggy prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect task environment with initial project directory and counter file."

RUN mkdir -p /home/user/prefect-project && \
    echo "0" > /home/user/prefect-project/counter.txt && \
    mkdir -p /home/user/prefect-project/locks

# Container contents:
#   - prefect installed via pip.
#   - /home/user/prefect-project - project directory
#   - /home/user/prefect-project/counter.txt - initialized to 0
#   - /home/user/prefect-project/locks - directory for file locks

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]