FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi
ARG TYPESENSE_VERSION=26.0

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL -o /tmp/typesense.tar.gz https://dl.typesense.org/releases/${TYPESENSE_VERSION}/typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    tar -xzf /tmp/typesense.tar.gz -C /usr/local/bin && \
    rm -f /tmp/typesense.tar.gz && \
    chmod +x /usr/local/bin/typesense-server && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests pochi-verifier && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Empty project directory that the executor will populate with the admin UI app.
RUN mkdir -p /home/user/admin-ui

# Seed the raw dirty dataset that the grader will import through the UI.
# The collection itself is NOT pre-created: it must be built by the executor's app.
RUN mkdir -p /home/user/dataset && \
    cat >/home/user/dataset/products.jsonl <<'EOF'
{"id":"p1","title":"Wireless Mouse","brand":"Acme","price":29.99,"rating":4,"tags":["pc","accessory"],"in_stock":true}
{"id":"p2","title":"Mechanical Keyboard","brand":"Acme","price":"89.99","rating":5,"tags":["pc","gaming"],"in_stock":true}
{"id":"p3","title":"USB-C Cable","brand":"Belkin","price":9.5,"rating":"3","in_stock":true}
{"id":"p4","title":"Laptop Stand","brand":"Rain Design","price":"45","in_stock":false}
{"id":"p5","title":"Broken Widget","brand":"NoName","price":"free","rating":2,"in_stock":true}
{"id":"p6","title":"Ghost Item","price":12.0,"in_stock":true}
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Typesense v26.0 native-binary + Node.js 20 admin-UI task environment with browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 runtime for the admin UI web app
#   - Typesense server v26.0 native binary at /usr/local/bin/typesense-server
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - python test deps: pytest-xprocess, requests
#   - /home/user/admin-ui: empty project directory for the executor's Node.js app
#   - /home/user/dataset/products.jsonl: seeded dirty dataset to import via the UI (collection NOT pre-created)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
