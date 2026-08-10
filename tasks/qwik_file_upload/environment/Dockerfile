FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep build-essential && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Scaffold a buildable Qwik City app (Qwik + Qwik City v1.20.0) served by a
# production Node SSR server. The upload feature itself is intentionally NOT
# implemented; the executor must implement it.
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user/qwik-upload/src/routes && \
    mkdir -p /home/user/qwik-upload/adapters/node-server

RUN cat > /home/user/qwik-upload/package.json <<'EOF'
{
  "name": "qwik-upload",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build && vite build --config adapters/node-server/vite.config.ts",
    "build.client": "vite build",
    "build.server": "vite build --config adapters/node-server/vite.config.ts",
    "serve": "node server/entry.node-server",
    "dev": "vite --mode ssr",
    "preview": "vite preview"
  },
  "dependencies": {
    "@builder.io/qwik": "1.20.0",
    "@builder.io/qwik-city": "1.20.0",
    "better-sqlite3": "13.0.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "7.6.11",
    "@types/node": "22.10.2",
    "typescript": "5.6.3",
    "vite": "5.4.11"
  }
}
EOF

RUN cat > /home/user/qwik-upload/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "allowJs": true,
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["es2022", "DOM", "DOM.Iterable", "WebWorker"],
    "jsx": "react-jsx",
    "jsxImportSource": "@builder.io/qwik",
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "incremental": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src", "*.ts", "*.tsx", "adapters"]
}
EOF

RUN cat > /home/user/qwik-upload/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite()],
    server: { port: 3000 },
    preview: { port: 3000 },
  };
});
EOF

RUN cat > /home/user/qwik-upload/adapters/node-server/vite.config.ts <<'EOF'
import { nodeServerAdapter } from '@builder.io/qwik-city/adapters/node-server/vite';
import { extendConfig } from '@builder.io/qwik-city/vite';
import baseConfig from '../../vite.config';

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: ['src/entry.node-server.tsx', '@qwik-city-plan'],
      },
    },
    plugins: [nodeServerAdapter({ name: 'node-server' })],
  };
});
EOF

RUN cat > /home/user/qwik-upload/src/entry.ssr.tsx <<'EOF'
import { renderToStream, type RenderToStreamOptions } from '@builder.io/qwik/server';
import { manifest } from '@qwik-client-manifest';
import Root from './root';

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    manifest,
    ...opts,
    containerAttributes: {
      lang: 'en-us',
      ...opts.containerAttributes,
    },
  });
}
EOF

RUN cat > /home/user/qwik-upload/src/entry.node-server.tsx <<'EOF'
/*
 * Production Node SSR server entry.
 * Build with `npm run build`, then start with `npm run serve` (listens on PORT, default 3000).
 */
import { createQwikCity } from '@builder.io/qwik-city/middleware/node';
import qwikCityPlan from '@qwik-city-plan';
import { manifest } from '@qwik-client-manifest';
import render from './entry.ssr';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 3000);

const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
  checkOrigin: false,
});

const server = createServer();

server.on('request', (req, res) => {
  staticFile(req, res, () => {
    router(req, res, () => {
      notFound(req, res, () => {});
    });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Node server listening on http://localhost:${PORT}`);
});
EOF

RUN cat > /home/user/qwik-upload/src/root.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Qwik Upload</title>
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > /home/user/qwik-upload/src/routes/index.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';

export default component$(() => {
  return <h1>Qwik Upload — not implemented</h1>;
});
EOF

RUN cd /home/user/qwik-upload && npm install --no-audit --no-fund

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik + Qwik City v1.20.0 app with a Node SSR server and better-sqlite3, for building a secure file-upload feature."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - build-essential + python3: to build the better-sqlite3 native module if a prebuilt binary is unavailable
#   - always required pip3 packages: pytest-json-ctrf
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - Node.js v22 (required by better-sqlite3 13)
#   - /home/user/qwik-upload: scaffolded, buildable Qwik City app (Qwik/Qwik City 1.20.0) with a
#       Node SSR production server (npm run build / npm run serve on port 3000) and better-sqlite3
#       available; the file-upload feature is NOT implemented and must be built by the executor.

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
