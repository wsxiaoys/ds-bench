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
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the Typesense standalone server binary (v26.0) to a global path.
RUN curl -fsSL https://dl.typesense.org/releases/26.0/typesense-server-26.0-linux-amd64.tar.gz -o /tmp/typesense.tar.gz && \
    tar -xzf /tmp/typesense.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/typesense-server && \
    rm -f /tmp/typesense.tar.gz && \
    test -x /usr/local/bin/typesense-server

# Non-secret local development API key for the Typesense server (fixed constant for this task).

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the product datasets used by the application (baseline is indexed on startup;
# the catalog is only indexed when ingested through the app).
RUN mkdir -p /home/user/saved-search-alerts/data && \
    cat > /home/user/saved-search-alerts/data/baseline.json <<'EOF'
[
  {"id": "b1", "name": "Aurora Wireless Headphones", "category": "electronics", "price": 199},
  {"id": "b2", "name": "Nimbus Bluetooth Speaker", "category": "electronics", "price": 89},
  {"id": "b3", "name": "Zenith Cookbook", "category": "books", "price": 25},
  {"id": "b4", "name": "Orbit Sci-Fi Novel", "category": "books", "price": 15},
  {"id": "b5", "name": "Comet Building Blocks", "category": "toys", "price": 40},
  {"id": "b6", "name": "Pixel Board Game", "category": "toys", "price": 30}
]
EOF
RUN cat > /home/user/saved-search-alerts/data/catalog.json <<'EOF'
[
  {"id": "i1", "name": "Solaris Wireless Earbuds", "category": "electronics", "price": 120},
  {"id": "i2", "name": "Galaxy USB Charger", "category": "electronics", "price": 45},
  {"id": "i3", "name": "Wireless Garden Doorbell", "category": "toys", "price": 60},
  {"id": "i4", "name": "Meteor Mystery Novel", "category": "books", "price": 12},
  {"id": "i5", "name": "Helix Programming Book", "category": "books", "price": 55}
]
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Typesense v26.0 saved-search-with-new-match-alerts web app task environment with Node.js 20 and browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libraries
#   - Node.js v20 runtime for the local web application (started with `npm start`)
#   - Typesense standalone server v26.0 at /usr/local/bin/typesense-server
#   - pip3 packages for tests: requests
#   - /home/user/saved-search-alerts: project directory the executor builds the app in
#   - /home/user/saved-search-alerts/data/baseline.json: baseline products indexed on startup
#   - /home/user/saved-search-alerts/data/catalog.json: ingest catalog shown in the UI

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
