FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-scaffold a minimal Node/TypeScript project with Capacitor Preferences and a
# jsdom-backed vitest toolchain already installed. The candidate must implement
# src/store.ts; node_modules is populated at build time so verification is offline.
RUN mkdir -p /home/user/project/src && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "versioned-store",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@capacitor/core": "^8.0.0",
    "@capacitor/preferences": "^8.0.0"
  },
  "devDependencies": {
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
EOF

RUN cd /home/user/project && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": []
  },
  "include": ["src", "__final__"]
}
EOF

RUN cd /home/user/project && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Node.js 22 + Capacitor Preferences project with a jsdom/vitest toolchain for building a versioned JSON store."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for the Capacitor/vitest task environment
#   - /home/user/project: pre-scaffolded project (package.json, tsconfig.json, node_modules)
#       dependencies: @capacitor/core, @capacitor/preferences
#       devDependencies: jsdom, typescript, vitest (used for offline CLI verification)
#   - The candidate implements /home/user/project/src/store.ts (not present initially)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
