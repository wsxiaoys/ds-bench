FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages prefect prefect-docker --ignore-installed pluggy

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect 3.0 environment with Docker integration for deployment tasks."

# Container contents:
#   - prefect and prefect-docker installed.
#   - /home/user - base directory for the user.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
