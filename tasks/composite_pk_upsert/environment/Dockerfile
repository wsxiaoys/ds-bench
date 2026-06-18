FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "project",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "express": "^4.19.0",
    "sequelize": "^6.37.0",
    "sqlite3": "^5.1.0"
  }
}
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Node.js environment with Express and Sequelize for composite primary key and upsert task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for the Express/Sequelize task
#   - additional pip3 packages: requests pytest-xprocess
#   - /home/user/project: directory for the project with package.json
