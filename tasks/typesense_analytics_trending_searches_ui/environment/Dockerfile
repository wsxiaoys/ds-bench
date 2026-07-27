FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL -o /tmp/typesense.tar.gz https://dl.typesense.org/releases/26.0/typesense-server-26.0-linux-amd64.tar.gz && \
    tar -xzf /tmp/typesense.tar.gz -C /usr/local/bin && \
    rm -f /tmp/typesense.tar.gz && \
    chmod +x /usr/local/bin/typesense-server && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Project directory + seeded product catalog dataset used by the app at startup.
RUN mkdir -p /home/user/trendsearch && \
    cat >/home/user/trendsearch/catalog-seed.json <<'EOF'
[
  {"id": "1", "name": "Gaming Laptop Pro 15", "category": "Electronics", "price": 1299.00},
  {"id": "2", "name": "Ultrabook Laptop Air", "category": "Electronics", "price": 999.00},
  {"id": "3", "name": "Smartphone Phone X", "category": "Electronics", "price": 799.00},
  {"id": "4", "name": "Budget Phone Lite", "category": "Electronics", "price": 199.00},
  {"id": "5", "name": "Mirrorless Camera Z6", "category": "Photography", "price": 1499.00},
  {"id": "6", "name": "Action Camera Hero", "category": "Photography", "price": 399.00},
  {"id": "7", "name": "Racing Drone FPV", "category": "Drones", "price": 549.00},
  {"id": "8", "name": "Camera Drone Mini", "category": "Drones", "price": 899.00},
  {"id": "9", "name": "Android Tablet 10", "category": "Electronics", "price": 329.00},
  {"id": "10", "name": "Pro Tablet Max", "category": "Electronics", "price": 1099.00},
  {"id": "11", "name": "Mechanical Keyboard RGB", "category": "Accessories", "price": 89.00},
  {"id": "12", "name": "Noise Cancelling Headphones", "category": "Audio", "price": 249.00}
]
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Typesense v26.0 search-analytics trending-searches web app task with Node.js runtime and browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 runtime for the search web app (started with `npm start`)
#   - Typesense v26.0 native server binary at /usr/local/bin/typesense-server
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and more
#   - pip3 test deps: requests, pytest-xprocess
#   - /home/user/trendsearch: project directory
#   - /home/user/trendsearch/catalog-seed.json: seeded product catalog dataset

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
