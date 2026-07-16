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
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-baked Capacitor + TypeScript project with all dependencies installed
# offline so the executor never needs network access at task time.
RUN mkdir -p /home/user/capacitor-http-app && \
    cd /home/user/capacitor-http-app && \
    cat >package.json <<'EOF'
{
  "name": "capacitor-http-app",
  "version": "1.0.0",
  "private": true,
  "description": "Capacitor HTTP typed client against a local mock server",
  "dependencies": {
    "@capacitor/core": "^8.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.0.0",
    "typescript": "^5.5.0",
    "tsx": "^4.16.0",
    "express": "^4.19.0"
  }
}
EOF

RUN cd /home/user/capacitor-http-app && \
    npm install --no-audit --no-fund && \
    npm ls @capacitor/core @capacitor/cli typescript tsx >/dev/null 2>&1 || true

LABEL Author="generate-harbor-tasks"
LABEL Description="Capacitor v8 CLI environment (Node.js 22) with a pre-installed TypeScript project for building a CapacitorHttp typed client against a local mock HTTP server."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - extra pip3 packages for verification: requests, pytest-xprocess
#   - Node.js v22 runtime for Capacitor v8
#   - /home/user/capacitor-http-app: pre-baked project with @capacitor/core, @capacitor/cli,
#     typescript, tsx, and express installed into node_modules (offline-ready)

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
