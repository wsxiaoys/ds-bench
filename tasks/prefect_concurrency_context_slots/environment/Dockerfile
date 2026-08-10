FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the target library and test dependencies in a dedicated layer.
# Use --ignore-installed so pip does not try (and fail) to uninstall the
# distutils-managed 'pluggy'/'pytest' shipped by the python3-pytest apt package.
RUN pip3 install --break-system-packages --ignore-installed pytest-json-ctrf "prefect==3.7.8"

# Run Prefect fully locally/offline: use an ephemeral, SQLite-backed API rooted at a
# fixed PREFECT_HOME shared by the task execution and verification processes.
ENV PREFECT_HOME=/home/user/.prefect
ENV PREFECT_SERVER_ALLOW_EPHEMERAL_MODE=true

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project && \
    mkdir -p /home/user/.prefect

LABEL Author="generate-harbor-tasks"
LABEL Description="Prefect 3.7.8 environment for a slot-based named concurrency-limit critical-section task, running fully offline in ephemeral mode."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - prefect==3.7.8 installed via pip3 (target library)
#   - PREFECT_HOME=/home/user/.prefect and ephemeral mode enabled for a fully local, offline Prefect API
#   - /home/user/project: working directory for the flow and the occupancy_proof.json artifact
#   - /home/user/.prefect: local Prefect home (SQLite DB, profiles) shared by executor and verifier

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
