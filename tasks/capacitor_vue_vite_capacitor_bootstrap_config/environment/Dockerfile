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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a Vue 3 + Vite (TypeScript) web project WITHOUT Capacitor.
# Vite's default build output directory is `dist`; Capacitor is intentionally
# not installed and no capacitor.config.ts exists yet.
RUN mkdir -p /home/user/vue-capacitor-app/src && \
    cd /home/user/vue-capacitor-app && \
    cat >package.json <<'EOF'
{
  "name": "vue-capacitor-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.5"
  }
}
EOF

RUN cd /home/user/vue-capacitor-app && \
    cat >index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue Capacitor Demo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

RUN cd /home/user/vue-capacitor-app && \
    cat >vite.config.ts <<'EOF'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
EOF

RUN cd /home/user/vue-capacitor-app && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "types": []
  },
  "include": ["src", "vite.config.ts", "capacitor.config.ts"]
}
EOF

RUN cd /home/user/vue-capacitor-app && \
    cat >src/main.ts <<'EOF'
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
EOF

RUN cd /home/user/vue-capacitor-app && \
    cat >src/App.vue <<'EOF'
<script setup lang="ts">
</script>

<template>
  <main>
    <h1>Vue Capacitor Demo</h1>
    <p>Bootstrap Capacitor into this Vue 3 + Vite web project.</p>
  </main>
</template>
EOF

RUN cd /home/user/vue-capacitor-app && \
    cat >src/vite-env.d.ts <<'EOF'
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
EOF

# Install base web dependencies at build time so the starting environment has
# node_modules and the web build can run offline during verification.
RUN cd /home/user/vue-capacitor-app && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Vue 3 + Vite (TypeScript) web project (Node.js 22) prepared for a web-only Capacitor v8 bootstrap/config task, including the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (Capacitor v8 requires Node 22+)
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libraries
#   - pip3 test dependencies: requests, pytest-xprocess
#   - /home/user/vue-capacitor-app: a Vue 3 + Vite (TS) project WITHOUT Capacitor installed
#       (default Vite outDir `dist`, no capacitor.config.ts) with node_modules pre-installed

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
