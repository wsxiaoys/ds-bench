FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi
ARG WASP_VERSION=0.16.7

ENV WASP_TELEMETRY_DISABLE=1

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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the Wasp CLI (classic main.wasp DSL, version pinned via the installer).
RUN curl -sSL https://get.wasp.sh/installer.sh | sh -s -- -v ${WASP_VERSION} && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp && \
    wasp version

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold the Wasp project skeleton the task starts from, then warm the
# generated Node dependency caches so the first `wasp start` at task/verify
# time does not have to download and install everything from scratch.
RUN cd /home/user && \
    wasp new taskboard -t basic && \
    cd /home/user/taskboard && \
    (timeout 480 wasp start > /tmp/wasp-warm.log 2>&1 || true) && \
    (rm -f /tmp/wasp-warm.log || true)

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16.7 (classic DSL) full-stack environment with Node.js 22, a scaffolded 'taskboard' project skeleton, local SQLite, and the browser verification toolchain."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (Wasp requires Node >= 20)
#   - Wasp CLI v0.16.7 (classic main.wasp DSL) at /usr/local/bin/wasp
#   - browser verification deps: pochi-verifier, agent-browser, ffmpeg and X/GTK libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/taskboard: scaffolded Wasp project skeleton (main.wasp, schema.prisma, src/), deps pre-warmed

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
