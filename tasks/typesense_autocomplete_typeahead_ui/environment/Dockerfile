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
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the Typesense v26.0 standalone native Linux binary.
RUN cd /tmp && \
    curl -fsSL -O https://dl.typesense.org/releases/${TYPESENSE_VERSION}/typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    tar -xzf typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    mv typesense-server /usr/local/bin/typesense-server && \
    chmod +x /usr/local/bin/typesense-server && \
    rm -f typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    test -x /usr/local/bin/typesense-server

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the immutable city dataset used by the typeahead application.
RUN mkdir -p /home/user/typeahead/data && \
    cat >/home/user/typeahead/data/cities.json <<'EOF'
[
  {"id": "1", "name": "San Francisco", "country": "USA", "population": 873965},
  {"id": "2", "name": "San Diego", "country": "USA", "population": 1386932},
  {"id": "3", "name": "San Antonio", "country": "USA", "population": 1434625},
  {"id": "4", "name": "San Jose", "country": "USA", "population": 1013240},
  {"id": "5", "name": "Santiago", "country": "Chile", "population": 5614000},
  {"id": "6", "name": "Santa Ana", "country": "USA", "population": 310227},
  {"id": "7", "name": "Sacramento", "country": "USA", "population": 524943},
  {"id": "8", "name": "Seattle", "country": "USA", "population": 744955},
  {"id": "9", "name": "Springfield", "country": "USA", "population": 166846},
  {"id": "10", "name": "Chicago", "country": "USA", "population": 2746388},
  {"id": "11", "name": "Houston", "country": "USA", "population": 2304580},
  {"id": "12", "name": "Phoenix", "country": "USA", "population": 1608139},
  {"id": "13", "name": "Boston", "country": "USA", "population": 675647},
  {"id": "14", "name": "Portland", "country": "USA", "population": 652503},
  {"id": "15", "name": "Denver", "country": "USA", "population": 715522}
]
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Typesense v26.0 native binary + Node.js v20 environment for building a typeahead/autocomplete search UI, including the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - Node.js v20 for building and running the typeahead web app
#   - Typesense v26.0 standalone native binary at /usr/local/bin/typesense-server
#   - /home/user/typeahead: project directory for the web app (executor creates the app)
#   - /home/user/typeahead/data/cities.json: seeded immutable city dataset (15 records)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
