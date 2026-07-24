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

WORKDIR /home/user/project

RUN cat > package.json <<'EOF'
{
  "name": "qwik-log-stream",
  "type": "module",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "vite --mode ssr",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@builder.io/qwik": "^1.20.0",
    "@builder.io/qwik-city": "^1.20.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vite": "^5.3.5",
    "vite-tsconfig-paths": "^5.0.1"
  }
}
EOF

RUN cat > tsconfig.json <<'EOF'
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
    "types": ["node", "vite/client"]
  },
  "include": ["src"]
}
EOF

RUN cat > vite.config.ts <<'EOF'
import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: 3000,
      host: true,
      strictPort: true,
    },
    preview: {
      port: 3000,
      host: true,
      strictPort: true,
    },
  };
});
EOF

RUN mkdir -p src/routes data && \
    cat > src/root.tsx <<'EOF'
import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Live Log Stream</title>
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > src/entry.ssr.tsx <<'EOF'
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
  });
}
EOF

RUN cat > src/entry.dev.tsx <<'EOF'
import { render, type RenderOptions } from "@builder.io/qwik";
import Root from "./root";

export default function (opts: RenderOptions) {
  return render(document, <Root />, opts);
}
EOF

RUN cat > src/routes/index.tsx <<'EOF'
import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Preload the log file so the streaming RPC can serve it.
const rawLog = readFileSync(join(process.cwd(), "data", "events.log"), "utf-8");

// A structured representation of a single parsed log line.
class LogEntry {
  constructor(
    public index: number,
    public level: string,
    public message: string,
  ) {}
}

// Stream the parsed log entries one at a time to the client.
export const streamLog = server$(async function* () {
  const lines = rawLog.split("\n").filter((line) => line.trim().length > 0);
  let index = 0;
  for (const line of lines) {
    const [level, message] = line.split("|");
    yield new LogEntry(index, level, message);
    index++;
    // Simulate a slow log source.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
});

interface ViewEntry {
  index: number;
  level: string;
  message: string;
}

export default component$(() => {
  const status = useSignal<"idle" | "streaming" | "done">("idle");
  const state = useStore<{ list: ViewEntry[] }>({ list: [] });

  return (
    <div>
      <h1>Live Log Stream</h1>
      <button
        id="start"
        onClick$={$(async () => {
          status.value = "streaming";
          state.list = [];
          const result = await streamLog();
          state.list = result as unknown as ViewEntry[];
          status.value = "done";
        })}
      >
        Start Stream
      </button>
      <p>
        Status: <span id="status">{status.value}</span>
      </p>
      <p>
        Received: <span id="count">{state.list.length}</span>
      </p>
      <p>
        Errors:{" "}
        <span id="errors">
          {state.list.filter((entry) => entry.level === "ERROR").length}
        </span>
      </p>
      <ul id="events">
        {state.list.map((entry) => (
          <li key={entry.index} data-idx={entry.index} data-level={entry.level}>
            {entry.level}: {entry.message}
          </li>
        ))}
      </ul>
    </div>
  );
});
EOF

RUN cat > data/events.log <<'EOF'
INFO|Server started
INFO|Listening on port 3000
WARN|High memory usage
ERROR|Failed to connect to cache
INFO|Retrying connection
ERROR|Timeout while reading stream
WARN|Slow response detected
INFO|Shutdown complete
EOF

RUN npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City 1.20 SSR app with a broken async-generator server\$ streaming RPC log viewer to be fixed; includes browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and more
#   - Node.js v22 for the Qwik City dev server
#   - pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/project: Qwik City 1.20 SSR app (deps installed) with an intentionally broken
#     server$ async-generator streaming RPC in src/routes/index.tsx that the executor must fix
#   - /home/user/project/data/events.log: seeded 8-line local log file (server-only data source)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
