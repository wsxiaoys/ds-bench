FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

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

# Install the Typesense v26.0 standalone Linux binary and make it globally available.
RUN curl -fsSL -o /tmp/typesense-server.tar.gz https://dl.typesense.org/releases/26.0/typesense-server-26.0-linux-amd64.tar.gz && \
    tar -xzf /tmp/typesense-server.tar.gz -C /tmp && \
    mv /tmp/typesense-server /usr/local/bin/typesense-server && \
    chmod +x /usr/local/bin/typesense-server && \
    rm -f /tmp/typesense-server.tar.gz

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the immutable product dataset used by the filter builder task.
RUN mkdir -p /home/user/filterchip/data && \
    cat >/home/user/filterchip/data/products.jsonl <<'EOF'
{"id":"1","name":"Wireless Mouse","category":"Electronics","brand":"Logi","price":25.0,"rating":4.5,"tags":["pc","accessory"]}
{"id":"2","name":"Mechanical Keyboard","category":"Electronics","brand":"Smith, Jones & Co.","price":89.99,"rating":4.8,"tags":["pc","gaming"]}
{"id":"3","name":"USB-C Cable","category":"Electronics","brand":"Logi","price":9.99,"rating":4.0,"tags":["accessory"]}
{"id":"4","name":"Office Chair","category":"Furniture","brand":"ErgoMax","price":199.0,"rating":4.2,"tags":["office"]}
{"id":"5","name":"Standing Desk","category":"Furniture","brand":"ErgoMax","price":349.5,"rating":4.7,"tags":["office","home"]}
{"id":"6","name":"Coffee Mug","category":"Kitchen","brand":"Smith, Jones & Co.","price":12.5,"rating":3.9,"tags":["home"]}
{"id":"7","name":"Gaming Headset","category":"Electronics","brand":"AudioX","price":59.0,"rating":4.3,"tags":["pc","gaming","accessory"]}
{"id":"8","name":"Desk Lamp","category":"Furniture","brand":"Lumina","price":39.99,"rating":4.1,"tags":["office","home"]}
{"id":"9","name":"Notebook","category":"Stationery","brand":"PaperCo","price":4.5,"rating":4.6,"tags":["office"]}
{"id":"10","name":"Monitor Stand","category":"Electronics","brand":"ErgoMax","price":45.0,"rating":4.4,"tags":["pc","office"]}
{"id":"11","name":"Blender","category":"Kitchen","brand":"AudioX","price":75.0,"rating":4.0,"tags":["home"]}
{"id":"12","name":"Water Bottle","category":"Kitchen","brand":"Smith, Jones & Co.","price":18.0,"rating":4.9,"tags":["home","office"]}
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Typesense v26.0 filter-chip-builder task environment with Node.js v22, a seeded product dataset, and browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification deps: pochi-verifier, agent-browser, ffmpeg and supporting libs
#   - test deps (pip3): requests, pytest-xprocess
#   - Node.js v22 runtime available for building the web app
#   - Typesense v26.0 standalone server binary at /usr/local/bin/typesense-server
#   - /home/user/filterchip: project directory (agent builds the app here)
#   - /home/user/filterchip/data/products.jsonl: immutable seed dataset (12 products)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
