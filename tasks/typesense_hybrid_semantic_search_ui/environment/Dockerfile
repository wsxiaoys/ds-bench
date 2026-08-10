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

# Install the Typesense native server binary (v26.0) and expose it globally.
RUN curl -fsSL -o /tmp/typesense-server.tar.gz \
        "https://dl.typesense.org/releases/${TYPESENSE_VERSION}/typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz" && \
    tar -xzf /tmp/typesense-server.tar.gz -C /usr/local/bin && \
    rm -f /tmp/typesense-server.tar.gz && \
    chmod +x /usr/local/bin/typesense-server && \
    test -x /usr/local/bin/typesense-server

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed the knowledge-base project directory with the fixed, pre-computed dataset.
# Every document carries an 8-dimensional pre-computed embedding vector, and the
# query-vector lookup table maps each evaluation query string to its 8-dim vector,
# so NO embedding model is ever needed or downloaded at runtime.
RUN mkdir -p /home/user/kbsearch/data
RUN cat >/home/user/kbsearch/data/documents.json <<'EOF'
[
  {
    "id": "d1",
    "title": "Improving Page Load Performance",
    "body": "Techniques to make pages render faster using caching, compression, lazy loading, and CDN delivery.",
    "embedding": [0.95, 0.10, 0.08, 0.03, 0.02, 0.02, 0.02, 0.02]
  },
  {
    "id": "d2",
    "title": "Website Speed Myths",
    "body": "Common myths about website speed and why some slow tuning tricks do not actually help.",
    "embedding": [0.05, 0.05, 0.05, 0.95, 0.05, 0.05, 0.05, 0.05]
  },
  {
    "id": "d3",
    "title": "Database Indexing Guide",
    "body": "How to design indexes so queries return results efficiently at scale.",
    "embedding": [0.05, 0.95, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]
  },
  {
    "id": "d4",
    "title": "Introduction to CSS Grid",
    "body": "Build responsive two dimensional layouts with rows, columns, and gaps.",
    "embedding": [0.05, 0.05, 0.95, 0.05, 0.05, 0.05, 0.05, 0.05]
  },
  {
    "id": "d5",
    "title": "Understanding HTTP Caching",
    "body": "How browsers store responses to reduce round trips and improve latency.",
    "embedding": [0.30, 0.05, 0.05, 0.05, 0.90, 0.05, 0.05, 0.05]
  },
  {
    "id": "d6",
    "title": "Guide to Unit Testing",
    "body": "Write small focused tests that verify individual functions in isolation.",
    "embedding": [0.05, 0.05, 0.05, 0.05, 0.05, 0.95, 0.05, 0.05]
  },
  {
    "id": "d7",
    "title": "Getting Started with Docker",
    "body": "Package applications and their dependencies into portable container images.",
    "embedding": [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.95, 0.05]
  },
  {
    "id": "d8",
    "title": "Basics of Git Branching",
    "body": "Create, merge, and manage parallel lines of development in a repository.",
    "embedding": [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.95]
  }
]
EOF
RUN cat >/home/user/kbsearch/data/query_vectors.json <<'EOF'
{
  "speed up slow website": [0.90, 0.10, 0.10, 0.05, 0.05, 0.05, 0.05, 0.05],
  "how to make my app faster": [0.88, 0.12, 0.08, 0.05, 0.05, 0.05, 0.05, 0.05],
  "store data in tables": [0.05, 0.90, 0.08, 0.05, 0.05, 0.05, 0.05, 0.05]
}
EOF

# Local-only dummy admin key for the self-contained Typesense server (not a real secret).
# Both the app and the verifier authenticate to the local server with this value.

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Typesense v26.0 native server + Node.js 20 environment for a keyword/semantic/hybrid knowledge-base search web app, with browser-verification tooling and a pre-computed embedding dataset."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - Node.js v20 runtime for building the web application (Python 3 also available)
#   - Typesense native server v26.0 at /usr/local/bin/typesense-server (validated with test -x)
#   - pip3 test deps: requests, pytest-xprocess
#   - /home/user/kbsearch: knowledge-base search project directory (executor builds the app + start.sh here)
#   - /home/user/kbsearch/data/documents.json: 8 seed documents, each with an 8-dim pre-computed embedding
#   - /home/user/kbsearch/data/query_vectors.json: pre-computed query-vector lookup table for evaluation queries

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
