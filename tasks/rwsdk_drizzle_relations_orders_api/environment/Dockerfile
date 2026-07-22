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

# Scaffold a fresh RedwoodSDK project and install its dependencies so the
# environment matches the initial-state expectations (rwsdk project at
# /home/user/project with src/worker.tsx and rwsdk listed in package.json).
RUN cd /home/user && \
    npx -y create-rwsdk project && \
    cd project && \
    npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK project scaffold for building a Cloudflare D1 + Drizzle ORM relational orders API."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - pip3 packages for verification: requests, pytest-xprocess
#   - Node.js v22 for the RedwoodSDK (Vite) task environment
#   - /home/user/project: freshly scaffolded RedwoodSDK project (deps installed)
#     used to implement the Cloudflare D1 + Drizzle relational orders API

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
