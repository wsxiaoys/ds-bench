FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Scaffold a minimal Qwik City (Qwik 1.11.x) project at /home/user/qwik-search.
# The agent must implement /api/search and the search page in src/routes.
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user/qwik-search/src/routes

RUN cat > /home/user/qwik-search/package.json <<'EOF'
{
  "name": "qwik-search",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite --mode ssr",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@builder.io/qwik": "1.11.0",
    "@builder.io/qwik-city": "1.11.0",
    "typescript": "5.4.5",
    "vite": "5.2.11",
    "vite-tsconfig-paths": "4.3.2"
  }
}
EOF

RUN cat > /home/user/qwik-search/vite.config.ts <<'EOF'
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

RUN cat > /home/user/qwik-search/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@builder.io/qwik",
    "strict": true,
    "lib": ["DOM", "ES2022", "DOM.Iterable"],
    "types": ["node", "vite/client"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
EOF

RUN cat > /home/user/qwik-search/src/entry.ssr.tsx <<'EOF'
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

RUN cat > /home/user/qwik-search/src/root.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Qwik Search</title>
      </head>
      <body>
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > /home/user/qwik-search/src/routes/layout.tsx <<'EOF'
import { component$, Slot } from '@builder.io/qwik';

export default component$(() => {
  return <Slot />;
});
EOF

RUN cat > /home/user/qwik-search/src/routes/index.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';

// Placeholder route. Replace with the debounced async search component.
export default component$(() => {
  return <div>Replace this with the search component.</div>;
});
EOF

RUN cd /home/user/qwik-search && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City 1.11 task environment (Node 20) with a scaffolded qwik-search project, Playwright+Chromium and browser verification deps for testing a race-safe debounced useResource$ search."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 for the Qwik City task environment
#   - browser verification deps: playwright + chromium, pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - pip3 test deps: requests, pytest-xprocess, playwright
#   - /home/user/qwik-search: pre-scaffolded Qwik City project (deps installed) awaiting the search implementation

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
