FROM ubuntu:24.04

ARG POCHI_VERSION

# --- Base tools, Node.js 22, Pochi CLI, browser system deps, Python libs ---- #
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# --- Seed a minimal, known-good RedwoodSDK starter at /home/user/app -------- #
RUN mkdir -p /home/user/app/src/app/pages

RUN cat > /home/user/app/package.json <<'EOF'
{
  "name": "metrics-dashboard-app",
  "version": "1.0.0",
  "description": "RedwoodSDK metrics dashboard starter",
  "main": "index.js",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "dev:init": "rw-scripts dev-init",
    "preview": "vite preview",
    "worker:run": "rw-scripts worker-run",
    "clean": "rm -rf ./node_modules/.vite",
    "release": "rw-scripts ensure-deploy-env && npm run clean && npm run build && wrangler deploy",
    "generate": "rw-scripts ensure-env && wrangler types --include-runtime false",
    "check": "npm run generate && npm run types",
    "types": "tsc"
  },
  "dependencies": {
    "capnweb": "^0.5.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "react-server-dom-webpack": "19.2.6",
    "rwsdk": "1.5.9"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "1.33.2",
    "@cloudflare/workers-types": "4.20260426.1",
    "@types/node": "~25.6.0",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "typescript": "6.0.3",
    "vite": "~8.1.0",
    "wrangler": "4.85.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "sharp",
      "workerd"
    ]
  }
}
EOF

RUN cat > /home/user/app/vite.config.mts <<'EOF'
import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
});
EOF

RUN cat > /home/user/app/wrangler.jsonc <<'EOF'
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "metrics-dashboard-app",
  "main": "src/worker.tsx",
  "compatibility_date": "2025-08-21",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  },
  "vars": {}
}
EOF

RUN cat > /home/user/app/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "es2021",
    "lib": ["DOM", "DOM.Iterable", "ESNext", "ES2022"],
    "jsx": "react-jsx",
    "module": "es2022",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types", "./worker-configuration.d.ts"],
    "paths": {
      "@/*": ["./src/*"]
    },
    "resolveJsonModule": true,
    "checkJs": false,
    "noEmit": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", ".tmp"]
}
EOF

RUN cat > /home/user/app/worker-configuration.d.ts <<'EOF'
// Placeholder Cloudflare env types. Run `npm run generate` to regenerate after
// editing wrangler.jsonc (e.g. after adding Durable Object or D1 bindings).
declare namespace Cloudflare {
  interface Env {}
}
interface Env extends Cloudflare.Env {}
EOF

RUN cat > /home/user/app/src/client.tsx <<'EOF'
import { initClient, initClientNavigation } from "rwsdk/client";

const { handleResponse, onHydrated } = initClientNavigation();
initClient({ handleResponse, onHydrated });
EOF

RUN cat > /home/user/app/src/app/document.tsx <<'EOF'
export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Metrics Dashboard</title>
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body>
      {children}
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
EOF

RUN cat > /home/user/app/src/app/headers.ts <<'EOF'
import { RouteMiddleware } from "rwsdk/router";

export const setCommonHeaders =
  (): RouteMiddleware =>
  ({ response }) => {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "no-referrer");
  };
EOF

RUN cat > /home/user/app/src/app/pages/home.tsx <<'EOF'
export function Home() {
  return (
    <div>
      <h1>Metrics App</h1>
      <p>Starter home page. Build the dashboard at /metrics.</p>
    </div>
  );
}
EOF

RUN cat > /home/user/app/src/worker.tsx <<'EOF'
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(Document, [route("/", Home)]),
]);
EOF

# --- Install dependencies so the starter is ready to run -------------------- #
RUN cd /home/user/app && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK 1.5.9 starter at /home/user/app plus Python Playwright/Chromium for multi-context browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js 22 for the RedwoodSDK (Vite) dev server
#   - Python browser verification stack: playwright (+ chromium), pytest-xprocess, requests
#   - browser system libraries for headless Chromium
#   - /home/user/app: minimal RedwoodSDK 1.5.9 starter (home route only), deps installed (node_modules/rwsdk present)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
