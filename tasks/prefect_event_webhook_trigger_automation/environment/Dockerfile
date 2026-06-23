FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi

RUN pip3 install --break-system-packages prefect pytest

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect 3.0 environment for event-driven automation task."

RUN mkdir -p /home/user/project

# Container contents:
#   - prefect and pytest installed via pip
#   - /home/user/project  — Empty project directory for the task

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
