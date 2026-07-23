FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf prefect==3.4.20 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Prefect runs fully locally against its ephemeral API backed by local SQLite.
# Pin PREFECT_HOME so the CLI (limit management) and the pipeline process share
# the same local database. Do NOT set PREFECT_API_URL: leaving it unset keeps
# Prefect in offline/ephemeral mode (no Cloud, no remote server).
ENV PREFECT_HOME=/home/user/.prefect

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Prefect 3.4.20 offline environment for a global-concurrency-limit throttling task in /home/user/project."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Prefect 3.4.20 installed via pip3 (used fully offline via ephemeral API + local SQLite)
#   - PREFECT_HOME=/home/user/.prefect so CLI and pipeline share one local DB
#   - /home/user/project: empty project directory where the agent creates pipeline.py

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
