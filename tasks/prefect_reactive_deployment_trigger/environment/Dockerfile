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
    uv pip install --python /opt/venv/bin/python pytest importlib-metadata pytest-json-ctrf pochi-verifier requests prefect==3.7.8 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:${PATH}"

# Point every Prefect client at the local self-hosted server (UI http://127.0.0.1:4200).
ENV PREFECT_API_URL=http://127.0.0.1:4200/api

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/reactive_pipeline

# Bootstrap script that starts the local self-hosted Prefect server in the background.
RUN cat >/usr/local/bin/prefect-bootstrap.sh <<'EOF' && chmod +x /usr/local/bin/prefect-bootstrap.sh
#!/bin/bash
export PREFECT_API_URL="http://127.0.0.1:4200/api"
mkdir -p /var/log
if ! curl -fsS http://127.0.0.1:4200/api/health >/dev/null 2>&1; then
  nohup prefect server start --host 127.0.0.1 --port 4200 >/var/log/prefect-server.log 2>&1 &
fi
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:4200/api/health >/dev/null 2>&1; then
    echo "Prefect server is healthy at http://127.0.0.1:4200/api"
    break
  fi
  sleep 2
done
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Prefect 3.7.8 self-hosted environment (local server on 127.0.0.1:4200) with browser-verification tooling for event-driven deployment chaining."

CMD ["/bin/bash", "-c", "/usr/local/bin/prefect-bootstrap.sh; trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and more
#   - Prefect 3.7.8 installed via pip3 (local self-hosted server + CLI)
#   - requests installed via pip3 for final-state test API polling
#   - PREFECT_API_URL preset to the local server API (http://127.0.0.1:4200/api)
#   - /usr/local/bin/prefect-bootstrap.sh: starts the local Prefect server (invoked by CMD)
#   - /home/user/reactive_pipeline: empty project directory for the task

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
