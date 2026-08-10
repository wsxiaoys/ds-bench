FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh && \
    uv venv --python /usr/bin/python3 --seed /opt/venv && \
    uv pip install --python /opt/venv/bin/python pytest importlib-metadata pytest-json-ctrf pochi-verifier requests pytest-xprocess prefect==3.7.8 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:${PATH}"

ENV PREFECT_API_URL=http://127.0.0.1:4200/api

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/scheduler_project

LABEL Author="generate-harbor-tasks"
LABEL Description="Local self-hosted Prefect 3.7.8 environment for building a single deployment carrying three simultaneous schedules (cron, interval, rrule), with browser verification against the local Prefect UI."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK/NSS shared libraries
#   - Prefect 3.7.8 installed via pip3 (provides the `prefect` CLI, Python SDK, local server, and bundled UI)
#   - pip3 test dependencies: requests, pytest-xprocess (for final-state browser verification harness)
#   - ENV PREFECT_API_URL points to the local server API at http://127.0.0.1:4200/api
#   - /home/user/scheduler_project: empty project directory for the agent's deployment code

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
