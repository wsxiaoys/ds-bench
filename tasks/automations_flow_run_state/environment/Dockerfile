FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --ignore-installed prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect task environment for testing flow run state automations."

RUN mkdir -p /home/user/myproject

# Container contents:
#   - python3, pip, pytest, curl, git installed
#   - prefect installed via pip
#   - /home/user/myproject directory created

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
