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

# Pre-create the ArkType project skeleton that the executor must extend.
RUN mkdir -p /home/user/myproject

RUN cat >/home/user/myproject/package.json <<'EOF'
{
  "name": "arktype-declared-interface-conformance",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "validate": "tsx index.ts"
  },
  "dependencies": {
    "arktype": "2.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
EOF

RUN cat >/home/user/myproject/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "broken.ts"]
}
EOF

RUN cat >/home/user/myproject/types.ts <<'EOF'
export interface Product {
  id: string;
  sku: string;
  price: number;
  tags: string[];
}
EOF

# Install all npm dependencies inside the project directory so the initial
# state already contains a fully populated node_modules/ with arktype@2.2.0,
# typescript, and tsx available to the executor.
RUN cd /home/user/myproject && npm install --no-audit --no-fund --loglevel=error

LABEL Author="generate-harbor-tasks"
LABEL Description="ArkType type.declare<Product>() interface conformance project skeleton at /home/user/myproject."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 and npm for the ArkType project environment
#   - /home/user/myproject: ArkType project skeleton
#   - /home/user/myproject/package.json: pins arktype@2.2.0 and provides the `validate` script
#   - /home/user/myproject/tsconfig.json: strict TypeScript config that excludes broken.ts from the main include set
#   - /home/user/myproject/types.ts: pre-existing `interface Product` source of truth
#   - /home/user/myproject/node_modules: arktype, typescript, tsx, and @types/node pre-installed
