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

# Scaffold a RedwoodSDK starter project, seed the credential source, and install deps.
RUN cd /home/user && \
    npx -y create-rwsdk@latest project && \
    cd /home/user/project && \
    cat > users.json <<'EOF'
[
  { "id": "usr_alice", "username": "alice", "password": "correct-horse-battery-staple" },
  { "id": "usr_bob", "username": "bob", "password": "hunter2-passphrase" }
]
EOF

RUN cd /home/user/project && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK starter project at /home/user/project for building a KV-backed session login/logout flow."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for the RedwoodSDK task environment
#   - Python test deps: requests, pytest-xprocess (for HTTP verification of the dev server)
#   - /home/user/project: scaffolded RedwoodSDK app with dependencies installed
#   - /home/user/project/users.json: seed credential source (alice, bob)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
