FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-create the project directory with Sequelize v6 + the SQLite driver installed
# at build time so the task can run fully offline (no network at eval time).
RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "order-state-machine",
  "version": "1.0.0",
  "private": true,
  "description": "Order lifecycle finite state machine backed by Sequelize + SQLite.",
  "dependencies": {
    "sequelize": "^6.37.0",
    "sqlite3": "^5.1.7"
  }
}
EOF

RUN cd /home/user/project && npm install --no-audit --no-fund

LABEL Author="generate-harbor-tasks"
LABEL Description="Node.js 22 environment with Sequelize v6 and the SQLite driver pre-installed in /home/user/project for the order state machine task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 runtime for the Sequelize task
#   - /home/user/project: project dir with package.json and node_modules (sequelize@6, sqlite3) pre-installed for offline use

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
