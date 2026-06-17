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

# Initialize the @arktype/attest + vitest project skeleton expected by
# test_initial_state.py. The executor is responsible for adding the schema
# source, the vitest config, the attest global-setup file, and the test file.
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "arktype-attest-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "arktype": "2.2.0"
  },
  "devDependencies": {
    "@arktype/attest": "0.56.0",
    "vitest": "3.2.6",
    "typescript": "5.6.3",
    "@types/node": "22.10.1"
  },
  "overrides": {
    "arktype": "2.2.0"
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
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "tests", "setupVitest.ts", "vitest.config.ts"]
}
EOF

RUN cd /home/user/myproject && \
    npm install --no-audit --no-fund --loglevel=error

LABEL Author="generate-harbor-tasks"
LABEL Description="ArkType 2.2.0 + @arktype/attest 0.56.0 + vitest environment for the static+runtime attest tests task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (via NodeSource) for executing the vitest test runner
#   - /home/user/myproject: pre-initialized project with package.json (arktype@2.2.0, @arktype/attest@0.56.0, vitest, typescript)
#   - /home/user/myproject/tsconfig.json: TypeScript config with module/moduleResolution: NodeNext
#   - /home/user/myproject/node_modules: pre-installed dependencies (arktype, @arktype/attest, vitest, typescript, prettier transitively)
