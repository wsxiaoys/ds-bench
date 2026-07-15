FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    npm install -g @wasp.sh/wasp-cli@0.21.1 && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh minimal Wasp project that the executor will extend.
RUN cd /home/user && wasp new custom-middleware -t minimal

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.21.1 environment with a fresh minimal project at /home/user/custom-middleware for configuring custom Express middleware."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (satisfies the Wasp 0.21.1 generated server's node >=22.12 requirement)
#   - Wasp CLI 0.21.1 installed globally via npm (provides the `wasp` command)
#   - pip3 packages for verification: requests, pytest-xprocess
#   - /home/user/custom-middleware: fresh minimal Wasp project scaffolded with `wasp new -t minimal`

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
