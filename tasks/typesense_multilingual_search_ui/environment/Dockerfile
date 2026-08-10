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

# Install the standalone Typesense v26.0 native server binary.
RUN cd /tmp && \
    curl -fsSL -O https://dl.typesense.org/releases/${TYPESENSE_VERSION}/typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    tar -xzf typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    mv typesense-server /usr/local/bin/typesense-server && \
    chmod +x /usr/local/bin/typesense-server && \
    rm -f typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz && \
    test -x /usr/local/bin/typesense-server

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the multilingual catalog dataset (same items in English, French, German).
RUN mkdir -p /home/user/catalog-search/data && \
    cat >/home/user/catalog-search/data/catalog.json <<'EOF'
[
  {
    "id": "w1",
    "name_en": "Sourdough Baking Workshop",
    "name_fr": "Atelier de pain au levain",
    "name_de": "Sauerteig-Backkurs"
  },
  {
    "id": "w2",
    "name_en": "Ceramic Glazing Class",
    "name_fr": "Cours d'emaillage ceramique",
    "name_de": "Keramik-Glasurkurs"
  },
  {
    "id": "w3",
    "name_en": "Sauce Finishing Masterclass",
    "name_fr": "Nous finissons vos sauces",
    "name_de": "Wir verfeinern Ihre Saucen"
  },
  {
    "id": "w4",
    "name_en": "Wood Carving Basics",
    "name_fr": "Bases de la sculpture sur bois",
    "name_de": "Grundlagen des Schnitzens"
  },
  {
    "id": "w5",
    "name_en": "Vintage Café Signage",
    "name_fr": "Enseigne de café vintage",
    "name_de": "Vintage-Café-Beschilderung"
  },
  {
    "id": "w6",
    "name_en": "Naive Folk Painting",
    "name_fr": "Peinture folklorique naïve",
    "name_de": "Naive Volksmalerei"
  }
]
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Multilingual catalog search task: Node.js 20 + standalone Typesense v26.0 native binary, seeded EN/FR/DE dataset, and browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 runtime (node + npm) for the web application
#   - Typesense v26.0 standalone native server binary at /usr/local/bin/typesense-server
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/catalog-search: project directory (agent builds the app here)
#   - /home/user/catalog-search/data/catalog.json: seeded multilingual EN/FR/DE dataset

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
