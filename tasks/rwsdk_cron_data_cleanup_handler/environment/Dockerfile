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

# Scaffold a RedwoodSDK starter project and pre-install dependencies (including
# Drizzle ORM + drizzle-kit) so the executor starts from a working baseline.
RUN cd /home/user && \
    npx -y create-rwsdk project && \
    cd project && \
    npm install && \
    npm install drizzle-orm && \
    npm install -D drizzle-kit

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK (rwsdk) project scaffolded at /home/user/project with Node.js 22, Drizzle ORM, and Wrangler for a Cron Trigger + D1 data-cleanup task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - pip3 verification packages: requests, pytest-xprocess (used by tests/test_final_state.py)
#   - Node.js v22 (for RedwoodSDK / Vite / Wrangler tooling)
#   - /home/user/project: scaffolded RedwoodSDK starter with node_modules installed
#     and Drizzle ORM (drizzle-orm) + drizzle-kit available for the D1 cleanup task

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
