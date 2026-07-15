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
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess pochi-verifier altair pandas vl-convert-python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the project directory and bundle the local sales dataset (no network / no remote datasets).
RUN mkdir -p /home/user/project/data && \
    cat >/home/user/project/data/sales.csv <<'EOF'
date,category,sales
2023-01-01,Electronics,120
2023-02-01,Electronics,135
2023-03-01,Electronics,150
2023-04-01,Electronics,160
2023-05-01,Electronics,145
2023-06-01,Electronics,170
2023-07-01,Electronics,180
2023-08-01,Electronics,165
2023-09-01,Electronics,190
2023-10-01,Electronics,210
2023-11-01,Electronics,230
2023-12-01,Electronics,250
2023-01-01,Furniture,80
2023-02-01,Furniture,75
2023-03-01,Furniture,90
2023-04-01,Furniture,85
2023-05-01,Furniture,95
2023-06-01,Furniture,100
2023-07-01,Furniture,110
2023-08-01,Furniture,105
2023-09-01,Furniture,120
2023-10-01,Furniture,115
2023-11-01,Furniture,130
2023-12-01,Furniture,140
2023-01-01,Clothing,200
2023-02-01,Clothing,180
2023-03-01,Clothing,160
2023-04-01,Clothing,150
2023-05-01,Clothing,170
2023-06-01,Clothing,190
2023-07-01,Clothing,210
2023-08-01,Clothing,230
2023-09-01,Clothing,220
2023-10-01,Clothing,240
2023-11-01,Clothing,300
2023-12-01,Clothing,320
2023-01-01,Groceries,300
2023-02-01,Groceries,310
2023-03-01,Groceries,305
2023-04-01,Groceries,320
2023-05-01,Groceries,330
2023-06-01,Groceries,340
2023-07-01,Groceries,335
2023-08-01,Groceries,350
2023-09-01,Groceries,360
2023-10-01,Groceries,370
2023-11-01,Groceries,380
2023-12-01,Groceries,390
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment for building an offline interactive-legend cross-filter dashboard, including the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Vega-Altair stack: altair, pandas, vl-convert-python (for offline/inline HTML saving)
#   - browser verification dependencies: pochi-verifier, pytest-xprocess, agent-browser, ffmpeg, and more
#   - /home/user/project: task project directory
#   - /home/user/project/data/sales.csv: bundled local sales dataset (date, category, sales)

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
