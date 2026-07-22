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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess altair pandas && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project/data && \
    cat >/home/user/project/data/product_sales.csv <<'EOF'
period,category,sales
2023-Q1,Aurora,500
2023-Q1,Borealis,420
2023-Q1,Cascade,380
2023-Q1,Dynamo,300
2023-Q1,Everest,250
2023-Q2,Aurora,460
2023-Q2,Borealis,480
2023-Q2,Cascade,400
2023-Q2,Dynamo,350
2023-Q2,Everest,290
2023-Q3,Aurora,470
2023-Q3,Borealis,455
2023-Q3,Cascade,500
2023-Q3,Dynamo,410
2023-Q3,Everest,360
2023-Q4,Aurora,520
2023-Q4,Borealis,430
2023-Q4,Cascade,495
2023-Q4,Dynamo,470
2023-Q4,Everest,400
2024-Q1,Aurora,510
2024-Q1,Borealis,600
2024-Q1,Cascade,480
2024-Q1,Dynamo,520
2024-Q1,Everest,450
2024-Q2,Aurora,640
2024-Q2,Borealis,580
2024-Q2,Cascade,470
2024-Q2,Dynamo,560
2024-Q2,Everest,500
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment with a local quarterly product-sales CSV for building a bump chart, including the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair (+ pandas) installed via pip3
#   - test/verification pip3 packages: pochi-verifier, requests, pytest-xprocess
#   - browser verification dependencies: agent-browser, ffmpeg, and shared X/GTK libraries
#   - /home/user/project: task project directory
#   - /home/user/project/data/product_sales.csv: bundled local dataset (5 categories x 6 quarters)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
