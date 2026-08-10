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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier pytest-xprocess requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the native Typesense server binary (v26.0) and expose it globally.
RUN curl -fsSL -o /tmp/typesense-server.tar.gz https://dl.typesense.org/releases/26.0/typesense-server-26.0-linux-amd64.tar.gz && \
    tar -xzf /tmp/typesense-server.tar.gz -C /usr/local/bin && \
    rm -f /tmp/typesense-server.tar.gz && \
    chmod +x /usr/local/bin/typesense-server && \
    test -x /usr/local/bin/typesense-server

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed roster for the leaderboard project (deterministic initial state).
RUN mkdir -p /home/user/leaderboard && \
    cat > /home/user/leaderboard/players.json <<'EOF'
[
  {"player_id": "p1", "name": "Alice", "score": 100},
  {"player_id": "p2", "name": "Bob", "score": 100},
  {"player_id": "p3", "name": "Carol", "score": 90},
  {"player_id": "p4", "name": "Dave", "score": 80},
  {"player_id": "p5", "name": "Eve", "score": 70}
]
EOF

RUN tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /etc/typesense-api-key && chmod 444 /etc/typesense-api-key

LABEL Author="generate-harbor-tasks"
LABEL Description="Realtime Typesense leaderboard task: native Typesense v26.0 server, Node.js v22 + Python runtimes, and browser verification (agent-browser + pochi-verifier)."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 and Python 3 runtimes for building the web app
#   - Typesense server v26.0 native binary at /usr/local/bin/typesense-server (port 8108)
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - test deps: pytest-xprocess, requests
#   - /home/user/leaderboard: project directory (executor builds the app here)
#   - /home/user/leaderboard/players.json: seeded initial roster

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
