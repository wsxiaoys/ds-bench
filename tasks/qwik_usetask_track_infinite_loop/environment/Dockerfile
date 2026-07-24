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
RUN mkdir -p /home/user/qwik-app/src/routes

RUN cat > /home/user/qwik-app/package.json <<'EOF'
{
  "name": "qwik-app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@builder.io/qwik": "1.20.0",
    "@builder.io/qwik-city": "1.20.0",
    "typescript": "5.4.5",
    "vite": "5.3.5",
    "vite-tsconfig-paths": "4.3.2"
  }
}
EOF

RUN cat > /home/user/qwik-app/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "allowJs": true,
    "target": "ES2017",
    "module": "ES2022",
    "lib": ["es2022", "DOM", "DOM.Iterable"],
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

RUN cat > /home/user/qwik-app/vite.config.ts <<'EOF'
import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      host: "127.0.0.1",
      port: 3000,
    },
    preview: {
      host: "127.0.0.1",
      port: 3000,
    },
  };
});
EOF

RUN cat > /home/user/qwik-app/src/global.css <<'EOF'
:root {
  font-family: system-ui, sans-serif;
}

main {
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem;
}
EOF

RUN cat > /home/user/qwik-app/src/entry.ssr.tsx <<'EOF'
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

RUN cat > /home/user/qwik-app/src/root.tsx <<'EOF'
import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";

import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <title>Order Summary</title>
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
EOF

RUN cat > /home/user/qwik-app/src/routes/index.tsx <<'EOF'
import {
  component$,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

interface Item {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

interface OrderStore {
  items: Item[];
  couponApplied: boolean;
  totalCents: number;
}

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export default component$(() => {
  const store = useStore<OrderStore>({
    items: [
      { id: "keyboard", name: "Keyboard", unitPriceCents: 4999, quantity: 1 },
      { id: "mouse", name: "Mouse", unitPriceCents: 2550, quantity: 2 },
      { id: "monitor", name: "Monitor", unitPriceCents: 19900, quantity: 1 },
    ],
    couponApplied: false,
    totalCents: 0,
  });

  const autoRestock = useSignal(false);

  // Keep the displayed total in sync with the order.
  useTask$(({ track }) => {
    track(() => store);
    const subtotal = store.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    store.totalCents = store.couponApplied
      ? Math.round(subtotal * 0.9)
      : subtotal;
  });

  // Auto-restock: repeatedly bump the Mouse quantity while enabled.
  useVisibleTask$(({ track }) => {
    const enabled = track(() => autoRestock.value);
    if (!enabled) {
      return;
    }
    setInterval(() => {
      const mouse = store.items.find((i) => i.id === "mouse");
      if (mouse) {
        mouse.quantity++;
      }
    }, 500);
  });

  return (
    <main>
      <h1>Order Summary</h1>
      <ul>
        {store.items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>{" "}
            <button
              data-testid={`dec-${item.id}`}
              onClick$={() => {
                if (item.quantity > 0) item.quantity--;
              }}
            >
              -
            </button>{" "}
            <span data-testid={`qty-${item.id}`}>{item.quantity}</span>{" "}
            <button
              data-testid={`inc-${item.id}`}
              onClick$={() => item.quantity++}
            >
              +
            </button>
          </li>
        ))}
      </ul>

      <label>
        <input
          type="checkbox"
          data-testid="coupon"
          checked={store.couponApplied}
          onChange$={(_, el) => (store.couponApplied = el.checked)}
        />{" "}
        Apply 10% coupon
      </label>

      <p>
        Total: <span data-testid="total">{formatCents(store.totalCents)}</span>
      </p>

      <button
        data-testid="auto-toggle"
        onClick$={() => (autoRestock.value = !autoRestock.value)}
      >
        {autoRestock.value ? "Stop auto-restock" : "Start auto-restock"}
      </button>
    </main>
  );
});
EOF

RUN cd /home/user/qwik-app && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City v1.20.0 SSR app with a broken useTask$/track reactive architecture (self-triggering write, wrong track granularity, missing timer cleanup) to be repaired."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 for the Qwik City task environment
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/qwik-app: Qwik City SSR project (deps installed) with a broken reactive order-summary page at src/routes/index.tsx

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
