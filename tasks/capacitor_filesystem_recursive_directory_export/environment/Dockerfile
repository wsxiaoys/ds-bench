FROM ubuntu:24.04

ARG POCHI_VERSION

# Base tooling, Node.js v24, Pochi CLI, headless-browser system libraries, and the
# Python verification stack (pytest + pytest-xprocess + Playwright/Chromium).
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 \
        libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 \
        libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 \
        libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 \
        libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 \
        libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a Vite + TypeScript project that depends on @capacitor/core and
# @capacitor/filesystem (v8). The recursive export utility is intentionally NOT
# implemented; the executor must implement it in src/main.ts.
RUN mkdir -p /home/user/project/src

RUN cat > /home/user/project/package.json <<'EOF'
{
  "name": "recursive-directory-export",
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
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
EOF

RUN cat > /home/user/project/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 4173 },
  preview: { host: true, port: 4173 },
});
EOF

RUN cat > /home/user/project/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": []
  },
  "include": ["src"]
}
EOF

RUN cat > /home/user/project/index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recursive Directory Export</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

RUN cat > /home/user/project/src/main.ts <<'EOF'
// TODO: Implement the recursive directory export utility.
//
// When the page loads you must expose the following on `window`:
//   - window.CapacitorFilesystem = { Filesystem, Directory, Encoding }
//   - window.runDirectoryExport(options)
//
// See the task instructions for the exact behavior and manifest schema.
export {};
EOF

# Pre-install dependencies so the environment is offline-friendly and matches the
# state asserted by test_initial_state.py.
RUN cd /home/user/project && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Vite + TypeScript + Capacitor Filesystem (v8) web project for a recursive directory export task, verified with Playwright/Chromium in a headless browser."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for the Vite + Capacitor web project
#   - headless browser deps + Playwright Chromium (for scripted browser verification of the IndexedDB-backed filesystem)
#   - pip3: requests, pytest-xprocess, playwright (used by tests/test_final_state.py)
#   - /home/user/project: Vite + TypeScript scaffold with @capacitor/core and @capacitor/filesystem v8 installed
#   - /home/user/project/src/main.ts: stub the executor must implement (recursive export + window globals)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
