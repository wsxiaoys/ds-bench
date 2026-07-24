FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        build-essential && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# --- Scaffold a minimal Qwik City (v1.20.0) project as the starting environment ---
RUN mkdir -p /home/user/qwik-etag-hybrid/src/routes && \
    mkdir -p /home/user/qwik-etag-hybrid/data

RUN cat > /home/user/qwik-etag-hybrid/package.json <<'EOF'
{
  "name": "qwik-etag-hybrid",
  "description": "Hybrid content-negotiated product catalog",
  "type": "module",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "build": "vite build && vite build --ssr src/entry.preview.tsx",
    "build.client": "vite build",
    "build.preview": "vite build --ssr src/entry.preview.tsx",
    "dev": "vite --mode ssr",
    "preview": "vite build && vite build --ssr src/entry.preview.tsx && vite preview"
  },
  "dependencies": {
    "@builder.io/qwik": "1.20.0",
    "@builder.io/qwik-city": "1.20.0",
    "better-sqlite3": "^11.8.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "20.14.11",
    "typescript": "5.4.5",
    "vite": "5.3.5",
    "vite-tsconfig-paths": "4.3.2"
  }
}
EOF

RUN cat > /home/user/qwik-etag-hybrid/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "allowJs": true,
    "target": "ES2017",
    "module": "ES2022",
    "lib": ["es2022", "DOM", "WebWorker", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "@builder.io/qwik",
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "incremental": true,
    "isolatedModules": true,
    "outDir": "tmp",
    "noEmit": true,
    "types": ["node", "vite/client"],
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
EOF

RUN cat > /home/user/qwik-etag-hybrid/vite.config.ts <<'EOF'
import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
  };
});
EOF

RUN cat > /home/user/qwik-etag-hybrid/src/global.css <<'EOF'
:root { font-family: system-ui, sans-serif; }
EOF

RUN cat > /home/user/qwik-etag-hybrid/src/root.tsx <<'EOF'
import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";

import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Qwik Hybrid Catalog</title>
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > /home/user/qwik-etag-hybrid/src/entry.ssr.tsx <<'EOF'
import {
  renderToStream,
  type RenderToStreamOptions,
} from "@builder.io/qwik/server";
import { manifest } from "@qwik-client-manifest";
import Root from "./root";

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    manifest,
    ...opts,
    containerAttributes: {
      lang: "en-us",
      ...opts.containerAttributes,
    },
    serverData: {
      ...opts.serverData,
    },
  });
}
EOF

RUN cat > /home/user/qwik-etag-hybrid/src/entry.preview.tsx <<'EOF'
import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

/**
 * The default export is the QwikCity adapter used by Vite preview.
 */
export default createQwikCity({ render, qwikCityPlan });
EOF

RUN cat > /home/user/qwik-etag-hybrid/src/routes/layout.tsx <<'EOF'
import { component$, Slot } from "@builder.io/qwik";

export default component$(() => {
  return (
    <main>
      <Slot />
    </main>
  );
});
EOF

RUN cat > /home/user/qwik-etag-hybrid/src/routes/index.tsx <<'EOF'
import { component$ } from "@builder.io/qwik";

export default component$(() => {
  return <h1>Qwik Hybrid Catalog</h1>;
});
EOF

RUN cd /home/user/qwik-etag-hybrid && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City 1.20.0 project scaffold (Node.js 22, better-sqlite3) for the hybrid content-negotiated catalog task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - build-essential: native build toolchain for better-sqlite3
#   - always required pip3 packages: pytest-json-ctrf
#   - extra pip3 packages: requests, pytest-xprocess (used by tests/test_final_state.py)
#   - Node.js v22 runtime for the Qwik City app
#   - /home/user/qwik-etag-hybrid: scaffolded Qwik City 1.20.0 project (deps installed)
#       * package.json pins @builder.io/qwik and @builder.io/qwik-city to 1.20.0, includes better-sqlite3
#       * src/root.tsx, src/entry.ssr.tsx, src/entry.preview.tsx, src/routes/{layout,index}.tsx: base scaffold
#       * data/: pre-created directory for the local SQLite database (data/catalog.db)
#   - The /catalog route, the shared server-only data module, and the SQLite schema are to be implemented by the agent.

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
