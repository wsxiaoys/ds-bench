FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Bootstrap the ArkType project that the agent will extend with a vitest test suite.
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "arktype-attest-task",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "@arktype/attest": "0.56.0",
    "@types/node": "^20.12.0",
    "arktype": "2.2.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
EOF

RUN cd /home/user/myproject && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", ".attest", ".vitest"]
}
EOF

RUN cd /home/user/myproject && \
    cat >.gitignore <<'EOF'
node_modules
.attest
.vitest
dist
EOF

# Install the Node dependencies up-front so the initial state test sees them.
RUN cd /home/user/myproject && npm install --no-audit --no-fund --loglevel=error

LABEL Author="generate-harbor-tasks"
LABEL Description="ArkType project with arktype@2.2.0, @arktype/attest@0.56.0, and vitest preinstalled; the agent must wire up a vitest+attest test suite."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for executing vitest and the ArkType test suite
#   - /home/user/myproject: pre-initialized project with package.json (arktype@2.2.0, @arktype/attest@0.56.0, vitest, typescript) and tsconfig.json
#   - /home/user/myproject/node_modules: dependencies installed via `npm install`
