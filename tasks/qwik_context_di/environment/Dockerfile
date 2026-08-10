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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Pre-scaffold a minimal, buildable Qwik City (v1.20.0) application.
# `npm run build` produces the client bundle + the preview SSR server, and
# `npm run serve` starts a real per-request SSR server on port 3000 via
# `vite preview`. The routes/components below are placeholders that DO NOT
# satisfy the task's DOM contract; the executor must implement them.
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user/qwik-context-di/src/routes /home/user/qwik-context-di/src/components /home/user/qwik-context-di/public

RUN cat > /home/user/qwik-context-di/package.json <<'PKG_EOF'
{
  "name": "qwik-context-di",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build && vite build --ssr src/entry.preview.tsx",
    "build.client": "vite build",
    "build.preview": "vite build --ssr src/entry.preview.tsx",
    "dev": "vite --mode ssr",
    "serve": "vite preview --port 3000 --host 127.0.0.1",
    "qwik": "qwik"
  },
  "devDependencies": {
    "@builder.io/qwik": "1.20.0",
    "@builder.io/qwik-city": "1.20.0",
    "@types/node": "^20.14.11",
    "typescript": "^5.4.5",
    "vite": "^5.3.5",
    "vite-tsconfig-paths": "^4.3.2"
  }
}
PKG_EOF

RUN cat > /home/user/qwik-context-di/tsconfig.json <<'TS_EOF'
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
    "noEmit": true,
    "isolatedModules": true,
    "types": ["node", "vite/client"],
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
TS_EOF

RUN cat > /home/user/qwik-context-di/vite.config.ts <<'VITE_EOF'
import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
  };
});
VITE_EOF

RUN cat > /home/user/qwik-context-di/src/entry.ssr.tsx <<'SSR_EOF'
import {
  renderToStream,
  type RenderToStreamOptions,
} from "@builder.io/qwik/server";
import Root from "./root";

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    ...opts,
    containerAttributes: {
      lang: "en-us",
      ...opts.containerAttributes,
    },
  });
}
SSR_EOF

RUN cat > /home/user/qwik-context-di/src/entry.preview.tsx <<'PREVIEW_EOF'
import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

export default createQwikCity({ render, qwikCityPlan });
PREVIEW_EOF

RUN cat > /home/user/qwik-context-di/src/root.tsx <<'ROOT_EOF'
import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Qwik Context DI</title>
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
ROOT_EOF

RUN cat > /home/user/qwik-context-di/src/global.css <<'CSS_EOF'
:root {
  font-family: system-ui, sans-serif;
}
CSS_EOF

RUN cat > /home/user/qwik-context-di/src/routes/layout.tsx <<'LAYOUT_EOF'
import { component$, Slot } from "@builder.io/qwik";

// Placeholder root layout. Replace this to provide the shared contexts.
export default component$(() => {
  return <Slot />;
});
LAYOUT_EOF

RUN cat > /home/user/qwik-context-di/src/routes/index.tsx <<'INDEX_EOF'
import { component$ } from "@builder.io/qwik";

// Placeholder home route. Replace this to implement the storefront.
export default component$(() => {
  return <div>Implement the storefront here.</div>;
});
INDEX_EOF

RUN cd /home/user/qwik-context-di && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik 1.20.0 (Qwik City) SSR project scaffold for a context-based dependency-injection task, including the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 for the Qwik build/SSR runtime
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/qwik-context-di: pre-scaffolded Qwik City app (deps installed) whose
#       `npm run build` + `npm run serve` serve real per-request SSR on port 3000;
#       src/routes/layout.tsx and src/routes/index.tsx are placeholders to be implemented.

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
