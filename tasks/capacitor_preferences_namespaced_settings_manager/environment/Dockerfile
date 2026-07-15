FROM ubuntu:24.04

ARG POCHI_VERSION

# System packages, Node.js (v22 LTS), Pochi CLI, headless-Chromium runtime
# libraries, and the Python verification stack (pytest + playwright + xprocess).
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
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a Vite + Capacitor Preferences web project WITHOUT the settings
# manager implementation. The executor must implement `window.settings`.
RUN mkdir -p /home/user/settings-manager/src && \
    cd /home/user/settings-manager && \
    cat >package.json <<'EOF'
{
  "name": "settings-manager",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@capacitor/core": "^8.0.0",
    "@capacitor/preferences": "^8.0.0"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
EOF

RUN cd /home/user/settings-manager && \
    cat >vite.config.js <<'EOF'
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
  },
});
EOF

RUN cd /home/user/settings-manager && \
    cat >index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Namespaced Settings Manager</title>
  </head>
  <body>
    <div id="app">Namespaced Settings Manager</div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
EOF

RUN cd /home/user/settings-manager && \
    cat >src/main.js <<'EOF'
import { Preferences } from '@capacitor/preferences';

// TODO: Implement a namespaced settings manager on top of @capacitor/preferences.
// Expose it on the page as `window.settings` with the required async methods
// (get, set, reset, keys, exportNamespace, importNamespace).
console.log('Settings manager not implemented yet.', Preferences);
EOF

# Pre-install node_modules so the project is ready to build/preview offline.
RUN cd /home/user/settings-manager && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Capacitor Preferences namespaced settings manager task: Vite + @capacitor/preferences scaffold with a Playwright headless-Chromium verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (LTS) for building/serving the Capacitor web app
#   - headless Chromium runtime libraries + Python Playwright (chromium) for browser-based verification
#   - pip3 verification packages: requests, pytest-xprocess, playwright
#   - /home/user/settings-manager: Vite + @capacitor/core + @capacitor/preferences scaffold (no settings manager implemented yet), node_modules pre-installed

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
