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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the standalone Typesense v26.0 native server binary (local, no Docker-in-Docker).
RUN cd /tmp && \
    curl -fsSL -o typesense.tar.gz https://dl.typesense.org/releases/26.0/typesense-server-26.0-linux-amd64.tar.gz && \
    tar -xzf typesense.tar.gz && \
    mv typesense-server /usr/local/bin/typesense-server && \
    chmod +x /usr/local/bin/typesense-server && \
    rm -f typesense.tar.gz && \
    test -x /usr/local/bin/typesense-server

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the project directory with the fixed product dataset (searchable text lives in `name`).
RUN mkdir -p /home/user/app/data && \
    cat >/home/user/app/data/products.jsonl <<'EOF'
{"id":"az1","name":"Azura Audio Speaker Pro","brand":"Azura","popularity":100,"price":199.99}
{"id":"az2","name":"Azura Audio Earbuds","brand":"Azura","popularity":99,"price":89.5}
{"id":"az3","name":"Azura Audio Soundbar","brand":"Azura","popularity":98,"price":149.0}
{"id":"az4","name":"Azura Audio Headset","brand":"Azura","popularity":97,"price":59.99}
{"id":"az5","name":"Azura Audio Mic","brand":"Azura","popularity":96,"price":39.99}
{"id":"bo1","name":"Boreas Audio Amplifier","brand":"Boreas","popularity":90,"price":249.0}
{"id":"bo2","name":"Boreas Audio Receiver","brand":"Boreas","popularity":89,"price":179.0}
{"id":"ci1","name":"Cirrus Audio Turntable","brand":"Cirrus","popularity":80,"price":129.0}
{"id":"ci2","name":"Cirrus Audio Mixer","brand":"Cirrus","popularity":79,"price":99.0}
{"id":"ci3","name":"Cirrus Audio Monitor","brand":"Cirrus","popularity":78,"price":119.0}
{"id":"de1","name":"Denali Audio Subwoofer","brand":"Denali","popularity":70,"price":159.0}
{"id":"de2","name":"Denali Audio Tweeter","brand":"Denali","popularity":69,"price":49.0}
{"id":"de3","name":"Denali Audio Cable","brand":"Denali","popularity":68,"price":19.0}
{"id":"de4","name":"Denali Audio Adapter","brand":"Denali","popularity":67,"price":14.5}
{"id":"ev1","name":"Everest Audio Console","brand":"Everest","popularity":60,"price":299.0}
{"id":"ev2","name":"Everest Audio Interface","brand":"Everest","popularity":59,"price":139.0}
{"id":"ev3","name":"Everest Audio Preamp","brand":"Everest","popularity":58,"price":109.0}
{"id":"ev4","name":"Everest Audio Splitter","brand":"Everest","popularity":57,"price":24.0}
{"id":"ev5","name":"Everest Audio Stand","brand":"Everest","popularity":56,"price":34.0}
{"id":"ev6","name":"Everest Audio Dongle","brand":"Everest","popularity":55,"price":12.0}
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Local Typesense v26.0 native server + Node.js grouped-search web app task environment with browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 runtime for the grouped-results web application (npm start on port 3000)
#   - Typesense v26.0 standalone native server binary at /usr/local/bin/typesense-server (local, port 8108)
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/app: project directory for the web application
#   - /home/user/app/data/products.jsonl: fixed 20-document seed dataset (grouped by brand)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
