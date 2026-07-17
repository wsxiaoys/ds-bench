FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi
ARG WASP_VERSION=0.16.8

ENV WASP_TELEMETRY_DISABLE=1
ENV PATH="/root/.local/bin:${PATH}"

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    curl -sSL https://get.wasp.sh/installer.sh | sh -s -- -v ${WASP_VERSION} && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh Wasp project (basic template) that the agent will extend.
RUN cd /home/user && \
    wasp new nested-comments && \
    test -f /home/user/nested-comments/main.wasp && \
    test -f /home/user/nested-comments/schema.prisma

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16.8 project scaffold at /home/user/nested-comments with Node.js 20, plus browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 (required to build/run the Wasp full-stack app)
#   - Wasp CLI v0.16.8 installed via the legacy installer (binary at /root/.local/bin/wasp, symlinked to /usr/local/bin/wasp)
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK shared libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/nested-comments: fresh Wasp project scaffold (basic template) the agent must extend

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
