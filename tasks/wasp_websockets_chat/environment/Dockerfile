FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi
ARG WASP_VERSION=0.16.8

# Base system, Node.js, Pochi CLI, browser-verification deps, and Python test deps.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier pytest-xprocess requests "python-socketio[client]" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the Wasp CLI (pinned) and expose it globally.
RUN curl -sSL https://get.wasp.sh/installer.sh | sh -s -- -v ${WASP_VERSION} && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp && \
    wasp version

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold the starter Wasp project (basic template, local SQLite by default) and
# warm the generated dependency cache so the first `wasp start` at eval time is fast.
# The warm-up does NOT implement any part of the task (no chat model, no webSocket).
RUN cd /home/user && \
    wasp new chatapp -t basic && \
    cd /home/user/chatapp && \
    (wasp db migrate-dev --name init || true)

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16.8 environment with a scaffolded 'basic' project at /home/user/chatapp for building a real-time WebSocket chat feature, including the browser verification toolchain."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (required by Wasp >= 0.16, and to run the generated full-stack app)
#   - Wasp CLI v0.16.8 (installed via installer.sh, symlinked to /usr/local/bin/wasp)
#   - browser verification deps: pochi-verifier, agent-browser, ffmpeg, and shared libs
#   - Python test deps: pytest-xprocess, requests, python-socketio[client]
#   - /home/user/chatapp: scaffolded Wasp "basic" starter (local SQLite), deps pre-warmed

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
