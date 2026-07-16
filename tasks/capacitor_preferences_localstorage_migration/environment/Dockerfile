FROM ubuntu:24.04

ARG POCHI_VERSION

# ---------------------------------------------------------------------------
# Base tooling: system packages, Node.js 22, Pochi CLI, Python test deps, and
# the system libraries Playwright's Chromium needs to run headless.
# ---------------------------------------------------------------------------
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess playwright && \
    python3 -m playwright install --with-deps chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Scaffold the starting Vite + Capacitor project (migration NOT implemented).
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user/storage-migration/src

RUN cat > /home/user/storage-migration/package.json <<'EOF'
{
  "name": "storage-migration",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@capacitor/core": "^8.4.2",
    "@capacitor/preferences": "^8.0.1"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.4.2",
    "typescript": "^5.6.0",
    "vite": "^8.1.4"
  }
}
EOF

RUN cat > /home/user/storage-migration/index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Storage Migration</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

RUN cat > /home/user/storage-migration/src/main.ts <<'EOF'
// Starting point for the storage-migration demo app.
//
// TODO: Implement a one-time, idempotent migration that moves legacy
// `localStorage` entries (keys prefixed with `legacy:`) into
// `@capacitor/preferences`, and expose it as `window.migrateStorage()`.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'Storage migration demo';
}
EOF

RUN cat > /home/user/storage-migration/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';

export default defineConfig({});
EOF

RUN cat > /home/user/storage-migration/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
EOF

RUN cat > /home/user/storage-migration/capacitor.config.ts <<'EOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.storagemigration',
  appName: 'Storage Migration',
  webDir: 'dist',
};

export default config;
EOF

# Install the project dependencies so the environment matches the initial-state test.
RUN cd /home/user/storage-migration && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Vite + Capacitor v8 web project for a localStorage -> @capacitor/preferences migration task, with Node.js 22 and Playwright/Chromium for headless verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js 22 for the Vite + Capacitor v8 project
#   - Playwright + Chromium (and system libs) for deterministic headless-browser verification
#   - pip3 packages for tests: requests, pytest-xprocess, playwright
#   - /home/user/storage-migration: Vite + Capacitor project with @capacitor/core and @capacitor/preferences installed (migration not yet implemented)

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
