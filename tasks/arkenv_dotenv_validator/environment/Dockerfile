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

# Initialize the ArkEnv project skeleton expected by test_initial_state.py.
# The executor will fill src/env.ts and cli.ts themselves; placeholder files
# are seeded so the initial-state checks for their presence pass.
RUN mkdir -p /home/user/myproject/src && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "arkenv-dotenv-validator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "arktype": "2.2.0",
    "arkenv": "0.12.1",
    "dotenv": "16.4.5"
  },
  "devDependencies": {
    "tsx": "4.19.2",
    "typescript": "5.6.3",
    "@types/node": "22.10.1"
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
  "include": ["src", "cli.ts"]
}
EOF

# Seed placeholder entrypoint files so the initial-state test can confirm the
# expected project layout. The executor is expected to overwrite cli.ts (and
# create src/env.ts or whatever helper modules they prefer) to implement the
# real validator.
RUN cd /home/user/myproject && \
    cat >cli.ts <<'EOF'
// Placeholder entrypoint. Replace this file with a CLI that uses arkenv to
// load /home/user/myproject/.env, validate the required schema, and emit
// either `VALID\n<json>` or `INVALID: <message>` on stdout (exit code 0 in
// both cases).
console.log("INVALID: cli.ts has not been implemented yet");
EOF

RUN cd /home/user/myproject && \
    npm install --no-audit --no-fund --loglevel=error

LABEL Author="generate-harbor-tasks"
LABEL Description="ArkEnv 0.12.1 + ArkType 2.2.0 + Node.js v24 environment for the dotenv-backed env validator task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (via NodeSource) for executing TypeScript via tsx
#   - /home/user/myproject: pre-initialized project with package.json pinning arktype@2.2.0 and arkenv@0.12.1
#   - /home/user/myproject/tsconfig.json: TypeScript config with module: NodeNext
#   - /home/user/myproject/cli.ts: placeholder CLI entrypoint (executor overwrites this)
#   - /home/user/myproject/node_modules: pre-installed dependencies (arktype, arkenv, dotenv, tsx, typescript)
