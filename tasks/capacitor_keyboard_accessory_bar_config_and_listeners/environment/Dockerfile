FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g tsx && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Scaffold the starting Capacitor v8 + Vite + TypeScript project.
# The Keyboard plugin is intentionally NOT configured and the keyboard
# show/hide handling is intentionally NOT wired up; the executor must do both.
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user/app/src

RUN cat > /home/user/app/package.json <<'EOF'
{
  "name": "keyboard-composer-app",
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
    "@capacitor/keyboard": "^8.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
EOF

RUN cat > /home/user/app/capacitor.config.ts <<'EOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.composer',
  appName: 'Composer',
  webDir: 'dist',
};

export default config;
EOF

RUN cat > /home/user/app/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
EOF

RUN cat > /home/user/app/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@capacitor/keyboard"]
  },
  "include": ["src", "capacitor.config.ts", "vite.config.ts"]
}
EOF

RUN cat > /home/user/app/index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Composer</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <main id="messages">
      <p>Chat messages go here.</p>
    </main>
    <footer id="composer">
      <input id="composer-input" type="text" placeholder="Message" />
      <button id="composer-send">Send</button>
    </footer>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

RUN cat > /home/user/app/src/style.css <<'EOF'
:root {
  --keyboard-offset: 0px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
}

#messages {
  padding: 16px;
  padding-bottom: 96px;
}

#composer {
  position: fixed;
  left: 0;
  right: 0;
  /* The composer bar rides above the on-screen keyboard using this offset. */
  bottom: var(--keyboard-offset);
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #f2f2f2;
  border-top: 1px solid #ccc;
  transition: bottom 0.2s ease;
}

#composer-input {
  flex: 1;
  padding: 8px;
}

body.keyboard-open #composer {
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
}
EOF

RUN cat > /home/user/app/src/main.ts <<'EOF'
// Entry point for the composer web app.
//
// TODO: Configure the @capacitor/keyboard plugin in capacitor.config.ts and
// wire up the keyboard show/hide handling here so that the composer bar is
// lifted above the on-screen keyboard while it is visible.

const composer = document.getElementById('composer');

if (!composer) {
  console.warn('Composer element not found.');
}
EOF

RUN cd /home/user/app && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Capacitor v8 + Vite + TypeScript composer app for configuring the @capacitor/keyboard plugin and wiring keyboard show/hide layout listeners; verified via CLI (tsx) and a headless Playwright browser."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (for Capacitor v8 / Vite build) and global `tsx` (evaluates capacitor.config.ts)
#   - browser verification: Playwright + chromium and the required system libraries
#   - pip3 packages for tests: pytest-xprocess, playwright
#   - /home/user/app: scaffolded Vite + TypeScript Capacitor project (deps pre-installed via npm install)
#       * capacitor.config.ts WITHOUT the Keyboard plugin configured (executor must add it)
#       * src/main.ts WITHOUT keyboard show/hide wiring (executor must add it)
#       * src/style.css already consumes the --keyboard-offset CSS variable; #composer bar present

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
