FROM ubuntu:24.04

ARG POCHI_VERSION

# ---------------------------------------------------------------------------
# Base system, Node.js 22, Pochi CLI, browser (Chromium) system libraries,
# and Python verification dependencies (incl. Playwright).
# ---------------------------------------------------------------------------
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        build-essential \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Scaffold a TanStack Start (React) application at /home/user/tanstack-auth
# using the official TanStack CLI (non-interactive), install dependencies, and
# warm the build so the type-safe route tree (routeTree.gen.ts) is generated.
# ---------------------------------------------------------------------------
ENV CI=1
RUN cd /home/user && \
    npx --yes @tanstack/cli@latest create tanstack-auth --framework react --no-examples --no-git -y && \
    cd /home/user/tanstack-auth && \
    node -e "const fs=require('fs');const p='./package.json';const j=JSON.parse(fs.readFileSync(p));j.scripts=j.scripts||{};if(!j.scripts.build)j.scripts.build='vite build';if(!j.scripts.start)j.scripts.start='node .output/server/index.mjs';fs.writeFileSync(p,JSON.stringify(j,null,2));" && \
    (test -d node_modules || npm install) && \
    (npm run build || true)

LABEL Author="generate-harbor-tasks"
LABEL Description="TanStack Start (React) app scaffold at /home/user/tanstack-auth for a session-auth task, with Node.js 22 and Playwright/Chromium browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - build-essential: native module builds (e.g. SQLite driver) via node-gyp
#   - Node.js 22 for the TanStack Start task environment
#   - browser verification: Playwright (Python) + Chromium and its system libraries
#   - pip3 verification packages: pytest-xprocess (long-running server), requests, playwright
#   - /home/user/tanstack-auth: scaffolded TanStack Start (React) app with dependencies installed

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
