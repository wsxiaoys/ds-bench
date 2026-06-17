FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash sqlite3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages prefect==3.0.0 pydantic==2.8.2

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect 3.0 environment for suspending and resuming flows task."

RUN mkdir -p /home/user/app && chmod 0755 /home/user/app

# Container contents:
#   - prefect 3.0 installed.
#   - /home/user/app  — project directory.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
