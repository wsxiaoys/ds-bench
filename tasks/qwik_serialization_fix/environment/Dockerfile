FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
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

# --- Seed the broken "Keyword Tally" Qwik City project ---------------------
RUN mkdir -p /home/user/keyword-tally/src/routes /home/user/keyword-tally/src/lib /home/user/keyword-tally/adapters/static

RUN cat > /home/user/keyword-tally/package.json <<'EOF'
{
  "name": "keyword-tally",
  "private": true,
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "build": "vite build && vite build -c adapters/static/vite.config.ts",
    "dev": "vite --mode ssr",
    "preview": "node serve-static.mjs"
  },
  "dependencies": {
    "@builder.io/qwik": "1.15.0",
    "@builder.io/qwik-city": "1.15.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
EOF

RUN cat > /home/user/keyword-tally/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "@builder.io/qwik",
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": []
  },
  "include": ["src"]
}
EOF

RUN cat > /home/user/keyword-tally/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite()],
  };
});
EOF

RUN cat > /home/user/keyword-tally/adapters/static/vite.config.ts <<'EOF'
import { staticAdapter } from '@builder.io/qwik-city/adapters/static/vite';
import { extendConfig } from '@builder.io/qwik-city/vite';
import baseConfig from '../../vite.config';

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: ['@qwik-city-plan'],
      },
    },
    plugins: [
      staticAdapter({
        origin: 'http://127.0.0.1:3000',
      }),
    ],
  };
});
EOF

RUN cat > /home/user/keyword-tally/serve-static.mjs <<'EOF'
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = 3000;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  p = normalize(p).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(DIST, p);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // fall through; will 404 if missing
  }
  return filePath;
}

const server = createServer(async (req, res) => {
  try {
    const filePath = await resolveFile(req.url || '/');
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${DIST} at http://${HOST}:${PORT}`);
});
EOF

RUN cat > /home/user/keyword-tally/src/entry.ssr.tsx <<'EOF'
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

RUN cat > /home/user/keyword-tally/src/root.tsx <<'EOF'
import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Keyword Tally</title>
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > /home/user/keyword-tally/src/routes/layout.tsx <<'EOF'
import { component$, Slot } from '@builder.io/qwik';

export default component$(() => {
  return <Slot />;
});
EOF

RUN cat > /home/user/keyword-tally/src/lib/activity-recorder.ts <<'EOF'
/**
 * A browser-only utility that records activity events for the current page
 * session. It is intentionally NOT serializable and must only ever be
 * constructed in the browser.
 */
export class ActivityRecorder {
  private events: string[] = [];
  private startedAt: number;

  constructor() {
    if (typeof window === 'undefined') {
      throw new Error('ActivityRecorder can only be created in the browser');
    }
    this.startedAt = window.performance.now();
  }

  /** Record a single event; returns the new total number of events. */
  record(label: string): number {
    this.events.push(label);
    return this.events.length;
  }

  /** The number of events recorded so far in this session. */
  get count(): number {
    return this.events.length;
  }
}
EOF

RUN cat > /home/user/keyword-tally/src/routes/index.tsx <<'EOF'
import { component$, useVisibleTask$ } from '@builder.io/qwik';
import { ActivityRecorder } from '../lib/activity-recorder';

const KEYWORDS = ['alpha', 'beta', 'gamma', 'delta'];

export default component$(() => {
  // These values are captured by the click handler below and therefore must
  // cross Qwik's `$` serialization boundary. As written, none of them can.
  const tally = new Map<string, number>();
  const touched = new Set<string>();
  let recorder: ActivityRecorder | undefined;

  // The recorder is browser-only; it is created once the page is active.
  useVisibleTask$(() => {
    recorder = new ActivityRecorder();
  });

  // A plain helper referenced from the click handler.
  const bump = (keyword: string) => {
    tally.set(keyword, (tally.get(keyword) ?? 0) + 1);
    touched.add(keyword);
    recorder?.record(`${keyword}=${tally.get(keyword)}`);
  };

  const total = [...tally.values()].reduce((sum, n) => sum + n, 0);

  return (
    <main>
      <h1>Keyword Tally</h1>
      <p data-testid="recorder-status">{recorder ? 'recording' : 'idle'}</p>
      <p data-testid="log-count">Events: {recorder ? recorder.count : 0}</p>
      <p data-testid="total">Total: {total}</p>
      <p data-testid="touched">Touched: {touched.size}</p>
      <ul>
        {KEYWORDS.map((keyword) => (
          <li key={keyword}>
            <button data-testid={`btn-${keyword}`} onClick$={() => bump(keyword)}>
              {keyword}: {tally.get(keyword) ?? 0}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
});
EOF

RUN cd /home/user/keyword-tally && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Broken Qwik 1.15.0 (Qwik City, static SSG) Keyword Tally app whose build fails due to non-serializable captures across the \$ boundary; includes browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for building/serving the Qwik app
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/keyword-tally: broken Qwik City (static SSG) project pinned to @builder.io/qwik(-city) 1.15.0
#       - src/routes/index.tsx: page component that captures a Map, a Set, a plain function, and a
#         browser-only class instance across the `$` boundary (build currently fails)
#       - src/lib/activity-recorder.ts: browser-only, non-serializable utility class
#       - adapters/static/vite.config.ts: static site (SSG) adapter so `npm run build` renders pages
#       - serve-static.mjs: self-contained Node static server used by `npm run preview` (port 3000)
#       - node_modules installed via `npm install`

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
