FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        build-essential && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-create the Node.js project with Sequelize v6 and the SQLite driver installed,
# so the task can run fully offline. The executor implements src/runner.js and run.js.
RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "sequelize-transaction-retry-busy",
  "version": "1.0.0",
  "private": true,
  "description": "Resilient SQLite transaction runner with Sequelize",
  "main": "src/runner.js",
  "license": "MIT",
  "dependencies": {
    "sequelize": "6.37.7",
    "sqlite3": "5.1.7"
  }
}
EOF

RUN cd /home/user/project && \
    npm install --no-audit --no-fund && \
    mkdir -p src && \
    node -e "console.log('sequelize', require('sequelize').version); require('sqlite3'); console.log('sqlite3 ok')"

LABEL Author="generate-harbor-tasks"
LABEL Description="Node.js v20 environment with Sequelize v6.37.7 and sqlite3 preinstalled in /home/user/project for a resilient SQLite transaction runner task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - build-essential: native build fallback for the sqlite3 driver
#   - Node.js v20 runtime + npm
#   - /home/user/project: preinitialized Node.js (CommonJS) project with sequelize@6.37.7 and sqlite3@5.1.7 installed offline
#   - /home/user/project/src: directory where the executor implements runner.js (run.js goes in the project root)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
