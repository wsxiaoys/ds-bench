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
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-scaffold the project and install all Node dependencies at build time so the
# task/verification environment works fully offline (no internet at runtime).
RUN mkdir -p /home/user/network-queue-app && \
    cd /home/user/network-queue-app && \
    cat >package.json <<'EOF'
{
  "name": "network-queue-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Offline-aware request queue using @capacitor/network (web).",
  "scripts": {
    "build": "vite build",
    "start": "echo 'Implement the build+serve start command' && exit 1"
  },
  "dependencies": {
    "@capacitor/core": "^8.0.0",
    "@capacitor/network": "^8.0.0",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
EOF

RUN cd /home/user/network-queue-app && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Capacitor v8 @capacitor/network offline request-queue task: Node.js 22, pre-installed @capacitor/core & @capacitor/network, express, vite, and Playwright/Chromium for headless browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification deps: Playwright (python) + Chromium and required system libs (ffmpeg, libnss3, libgbm1, ...)
#   - test deps (pip3): requests, pytest-xprocess, playwright
#   - Node.js v22 for building/serving the Capacitor web app
#   - /home/user/network-queue-app: pre-scaffolded project with package.json and
#     node_modules pre-installed offline (@capacitor/core, @capacitor/network, express, vite)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
