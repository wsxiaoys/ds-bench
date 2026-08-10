FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        xz-utils libgmp10 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    npm install -g @wasp.sh/wasp-cli@latest && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-initialize a minimal Wasp project (SQLite, local, no built-in auth).
WORKDIR /home/user
RUN wasp new jwt-api -t minimal

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp (local SQLite) environment for building a self-contained JWT auth layer over custom API endpoints."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (required by the Wasp CLI/runtime)
#   - Wasp CLI installed globally via npm (@wasp.sh/wasp-cli@latest)
#   - pip3 test libraries: requests, pytest-xprocess
#   - /home/user/jwt-api: pre-initialized minimal Wasp project (local SQLite database)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
