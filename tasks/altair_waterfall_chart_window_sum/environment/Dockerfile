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
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests pochi-verifier "altair>=5.2" pandas vl-convert-python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the project directory with the local cash-flow input data (no network required).
RUN mkdir -p /home/user/project/data && \
    cat >/home/user/project/data/cash_flow.csv <<'EOF'
label,amount
Begin,4000
Product A,1200
Product B,-800
Services,1500
Refunds,-600
Tax,-900
End,0
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment for building a waterfall chart from a local CSV, with browser verification support."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair (>=5.2) plus pandas and vl-convert-python for chart building/export
#   - test dependencies: pytest-xprocess, requests (HTTP server readiness + browser render check)
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and shared libs
#   - /home/user/project: task project directory
#   - /home/user/project/data/cash_flow.csv: local input data (7 sequential cash-flow rows)

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
