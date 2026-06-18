FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect 3.0 environment for custom result serializer task."

RUN mkdir -p /home/user/myproject

# Container contents:
#   - prefect installed via pip3.
#   - /home/user/myproject  — empty project directory for the task.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
