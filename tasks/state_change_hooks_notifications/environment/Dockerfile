FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages pytest prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect task environment with an empty project directory at /home/user/project."

RUN mkdir -p /home/user/project && \
    chmod 0755 /home/user/project

# Container contents:
#   - prefect installed
#   - /home/user/project - empty project directory

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]