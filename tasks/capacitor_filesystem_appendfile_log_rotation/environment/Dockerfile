FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
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

# Scaffold a minimal Vite + TypeScript web app that already depends on the
# Capacitor core and Filesystem plugins. The rolling logger itself is left
# unimplemented for the agent to build.
RUN mkdir -p /home/user/myproject/src && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "rolling-logger",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@capacitor/core": "^8.0.0",
    "@capacitor/filesystem": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
EOF

RUN cd /home/user/myproject && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src"]
}
EOF

RUN cd /home/user/myproject && \
    cat >index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rolling File Logger</title>
  </head>
  <body>
    <h1>Rolling File Logger</h1>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

RUN cd /home/user/myproject && \
    cat >src/main.ts <<'EOF'
// TODO: Implement a rolling file logger backed by @capacitor/filesystem (web
// implementation, IndexedDB) and expose it as `window.rollingLog`.
// Refer to the task instructions for the required behavior and API surface.
export {};
EOF

RUN cd /home/user/myproject && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Capacitor v8 Vite/TypeScript web app scaffold for building a rolling file logger with @capacitor/filesystem; includes Node.js 22 and Playwright/Chromium for headless verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for the Vite/Capacitor web app
#   - Playwright + Chromium (and system libs) for headless browser verification
#   - pip3 packages: pytest-xprocess, requests, playwright (for the final-state test harness)
#   - /home/user/myproject: pre-scaffolded Vite + TS app depending on @capacitor/core and @capacitor/filesystem, with node_modules installed
#   - /home/user/myproject/src/main.ts: placeholder for the agent's rolling logger implementation

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
