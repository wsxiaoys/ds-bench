FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Initialize the ArkType + Express project skeleton expected by test_initial_state.py.
# The executor is responsible for creating server.ts and any other source files.
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "arktype-standard-schema-express",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "arktype": "2.2.0",
    "express": "4.21.2"
  },
  "devDependencies": {
    "tsx": "4.19.2",
    "typescript": "5.6.3",
    "@types/node": "22.10.1",
    "@types/express": "4.17.21"
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
    "outDir": "dist"
  },
  "include": ["**/*.ts"]
}
EOF

RUN cd /home/user/myproject && \
    npm install --no-audit --no-fund --loglevel=error

LABEL Author="generate-harbor-tasks"
LABEL Description="ArkType 2.2.0 + Express + Node.js v24 environment for the Standard Schema Express validator task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: requests, pytest-xprocess (used by tests/test_final_state.py)
#   - Node.js v24 (via NodeSource) for running TypeScript via tsx
#   - /home/user/myproject: pre-initialized project with package.json (arktype@2.2.0, express, tsx, typescript)
#   - /home/user/myproject/tsconfig.json: TypeScript config with module: NodeNext
#   - /home/user/myproject/node_modules: pre-installed dependencies (arktype, express, tsx, typescript, @types/*)
