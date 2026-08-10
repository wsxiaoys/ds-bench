FROM ubuntu:24.04

ARG POCHI_VERSION

# Base system packages, Node.js v24, Pochi CLI, and Python test dependencies.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess playwright && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the Chromium browser (and its OS dependencies) used by the Playwright-based verifier.
RUN python3 -m playwright install --with-deps chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK starter project (pinned release) and install its dependencies.
# The realtime peer package(s) and any database wiring are intentionally NOT set up; wiring
# realtime + persistence + the notification center is the task.
RUN cd /home/user && \
    npx --yes create-rwsdk@latest create project --release v1.5.7 && \
    cd /home/user/project && \
    npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK (rwsdk) starter project at /home/user/project with Node.js v24 and a Playwright/Chromium verification environment for a realtime notification-center task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (via NodeSource) for the RedwoodSDK/Vite project
#   - Pochi CLI
#   - Python verification packages: pytest-xprocess, playwright (+ Chromium browser and OS deps)
#   - /home/user/project: RedwoodSDK starter project (rwsdk pinned to v1.5.7) with dependencies installed
#     (realtime peer packages and database persistence are deliberately left unconfigured)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
