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
    uv pip install --python /opt/venv/bin/python pytest importlib-metadata pytest-json-ctrf pochi-verifier prefect==3.4.25 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:${PATH}"

RUN mkdir -p /home/user && chmod 0755 /home/user

# Local-only Prefect server configuration (non-secret) and a short tag-concurrency
# slot wait so serialized workloads settle quickly.
ENV PREFECT_API_URL="http://127.0.0.1:4200/api"
ENV PREFECT_TASK_RUN_TAG_CONCURRENCY_SLOT_WAIT_SECONDS=3

LABEL Author="generate-harbor-tasks"
LABEL Description="Prefect 3.4.25 self-hosted server environment (local UI/API on 127.0.0.1:4200) with browser-verification tooling for a combined tag + global concurrency task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Prefect 3.4.25 installed via pip3 (self-hosted server + CLI)
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK shared libs
#   - /entrypoint.sh: generates the run-id and boots the local Prefect server (127.0.0.1:4200) before the main command
#   - /home/user: working directory root (the agent creates /home/user/concurrency_guard)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
