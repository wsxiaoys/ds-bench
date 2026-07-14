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

# Scaffold a RedwoodSDK project and install dependencies so the environment
# matches the initial state (rwsdk dependency, src/worker.tsx, wrangler.jsonc, node_modules).
RUN cd /home/user && \
    npx -y create-rwsdk project && \
    cd /home/user/project && \
    npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK (rwsdk) project scaffold at /home/user/project for building an R2-backed file download endpoint with HTTP Range support."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - pip3 packages for verification: requests, pytest-xprocess
#   - Node.js v22 (required by RedwoodSDK / create-rwsdk)
#   - /home/user/project: scaffolded RedwoodSDK project with dependencies installed (node_modules present)

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
