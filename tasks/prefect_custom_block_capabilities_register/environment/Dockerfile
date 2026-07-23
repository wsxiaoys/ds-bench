FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages --ignore-installed pluggy && \
    pip3 install --break-system-packages pytest-json-ctrf prefect==3.7.8 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Persist Prefect state (SQLite DB, profiles) in a fixed home so the executor and
# the verifier read the same server database.
ENV PREFECT_HOME=/home/user/.prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project && \
    mkdir -p /home/user/.prefect

LABEL Author="generate-harbor-tasks"
LABEL Description="Prefect 3.7.8 offline environment for building, registering, saving and loading a custom Block with a reusable local-filesystem capability."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Prefect 3.7.8 installed via pip3 (provides the `prefect` CLI and Python SDK)
#   - ENV PREFECT_HOME=/home/user/.prefect so executor and verifier share the persisted SQLite database
#   - /home/user/project: project directory for the task
#   - /home/user/.prefect: Prefect home holding the local server's SQLite database

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
