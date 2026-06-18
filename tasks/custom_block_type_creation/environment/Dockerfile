FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --ignore-installed prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect custom block type creation task environment"

RUN mkdir -p /home/user/myproject && \
    chmod 0755 /home/user/myproject

# Container contents:
#   - prefect installed
#   - /home/user/myproject - empty directory for the user to create the block

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]