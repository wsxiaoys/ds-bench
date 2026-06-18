FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project/convex/_generated && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "convex-circular-dependencies",
  "version": "1.0.0",
  "scripts": {
    "typecheck": "tsc --project convex/tsconfig.json"
  },
  "dependencies": {
    "convex": "^1.11.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

RUN cd /home/user/project && npm install

RUN cd /home/user/project && \
    cat >convex/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ES2021", "dom"],
    "forceConsistentCasingInFileNames": true,
    "allowJs": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  },
  "include": ["./**/*"],
  "exclude": ["./_generated"]
}
EOF

RUN cd /home/user/project && \
    cat >convex/_generated/api.d.ts <<'EOF'
import type { ApiFromModules } from "convex/server";
import type * as a from "../a.js";
import type * as b from "../b.js";
import type * as c from "../c.js";

export declare const api: ApiFromModules<{
  a: typeof a;
  b: typeof b;
  c: typeof c;
}>;
EOF

RUN cd /home/user/project && \
    cat >convex/_generated/api.js <<'EOF'
export const api = {};
EOF

RUN cd /home/user/project && \
    cat >convex/_generated/server.d.ts <<'EOF'
export * from "convex/server";
export declare const query: <T>(obj: { args?: any; handler: (ctx: any) => Promise<T> }) => ((ctx: any) => Promise<T>);
EOF

RUN cd /home/user/project && \
    cat >convex/_generated/server.js <<'EOF'
export * from "convex/server";
EOF

RUN cd /home/user/project && \
    cat >convex/a.ts <<'EOF'
import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const funcA = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.b.funcB);
  },
});
EOF

RUN cd /home/user/project && \
    cat >convex/b.ts <<'EOF'
import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const funcB = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.c.funcC);
  },
});
EOF

RUN cd /home/user/project && \
    cat >convex/c.ts <<'EOF'
import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const funcC = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.a.funcA);
  },
});
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Convex project with circular dependencies in generated API code."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for running npm commands
#   - /home/user/project: Convex project directory
#   - /home/user/project/convex: Convex functions and generated code with intentional circular dependencies
