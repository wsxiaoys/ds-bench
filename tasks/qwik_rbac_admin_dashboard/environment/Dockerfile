FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        build-essential \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a minimal, bootable Qwik City (v1.11.x) project baseline that the
# agent extends to implement the RBAC dashboard.
RUN mkdir -p /home/user/rbac-dashboard/src/routes

RUN cat > /home/user/rbac-dashboard/package.json <<'EOF'
{
  "name": "rbac-dashboard",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite --mode ssr",
    "build": "vite build",
    "preview": "vite preview",
    "start": "vite --mode ssr"
  },
  "dependencies": {},
  "devDependencies": {
    "@builder.io/qwik": "^1.11.0",
    "@builder.io/qwik-city": "^1.11.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vite-tsconfig-paths": "^4.2.1"
  }
}
EOF

RUN cat > /home/user/rbac-dashboard/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "allowJs": true,
    "target": "ES2017",
    "module": "ES2022",
    "lib": ["es2022", "DOM", "WebWorker", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "@builder.io/qwik",
    "strict": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "incremental": true,
    "isolatedModules": true,
    "outDir": "tmp",
    "noEmit": true,
    "types": ["node", "vite/client"]
  }
}
EOF

RUN cat > /home/user/rbac-dashboard/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
  };
});
EOF

RUN cat > /home/user/rbac-dashboard/src/entry.ssr.tsx <<'EOF'
import { renderToStream, type RenderToStreamOptions } from '@builder.io/qwik/server';
import { manifest } from '@qwik-client-manifest';
import Root from './root';

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    manifest,
    ...opts,
    containerAttributes: {
      lang: 'en',
      ...opts.containerAttributes,
    },
  });
}
EOF

RUN cat > /home/user/rbac-dashboard/src/entry.dev.tsx <<'EOF'
import { render, type RenderOptions } from '@builder.io/qwik';
import Root from './root';

export default function (opts: RenderOptions) {
  return render(document, <Root />, opts);
}
EOF

RUN cat > /home/user/rbac-dashboard/src/root.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>RBAC Dashboard</title>
      </head>
      <body>
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > /home/user/rbac-dashboard/src/routes/layout.tsx <<'EOF'
import { component$, Slot } from '@builder.io/qwik';

export default component$(() => {
  return <Slot />;
});
EOF

RUN cat > /home/user/rbac-dashboard/src/routes/index.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return <h1>RBAC Dashboard starter</h1>;
});

export const head: DocumentHead = {
  title: 'RBAC Dashboard',
};
EOF

RUN cd /home/user/rbac-dashboard && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City (v1.11.x) RBAC admin dashboard task environment with Node.js 20, native build tooling for better-sqlite3, and the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - build-essential for compiling native node modules (e.g., better-sqlite3)
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js 20 for the Qwik City task environment
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and more
#   - pip3 test deps: requests, pytest-xprocess
#   - /home/user/rbac-dashboard: minimal bootable Qwik City project scaffold (deps pre-installed)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
