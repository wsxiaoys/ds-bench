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

# ---------------------------------------------------------------------------
# Provision the initial SvelteKit project (adapter-auto, mismatched webDir).
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user/capsvelte/src/routes/status && \
    mkdir -p /home/user/capsvelte/static

RUN cat > /home/user/capsvelte/package.json <<'EOF'
{
  "name": "capsvelte",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/adapter-auto": "^6.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "vite": "^6.0.0",
    "@capacitor/cli": "^8.0.0"
  },
  "dependencies": {
    "@capacitor/core": "^8.0.0"
  }
}
EOF

RUN cat > /home/user/capsvelte/svelte.config.js <<'EOF'
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
	}
};

export default config;
EOF

RUN cat > /home/user/capsvelte/vite.config.js <<'EOF'
import { sveltekit } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
EOF

RUN cat > /home/user/capsvelte/capacitor.config.ts <<'EOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.example.capsvelte',
	appName: 'capsvelte',
	// NOTE: this directory is never produced by the current build setup.
	webDir: 'www'
};

export default config;
EOF

RUN cat > /home/user/capsvelte/src/app.html <<'EOF'
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
EOF

RUN cat > /home/user/capsvelte/src/routes/+page.js <<'EOF'
export const prerender = true;
EOF

RUN cat > /home/user/capsvelte/src/routes/+page.svelte <<'EOF'
<h1>Capacitor SvelteKit Home</h1>
<p>Welcome to the Capacitor-ready static bundle.</p>
<p><a href="/status">Go to runtime status</a></p>
EOF

RUN cat > /home/user/capsvelte/src/routes/status/+page.js <<'EOF'
// This route is intentionally client-rendered only: it must be served via the
// SPA fallback page rather than being prerendered to its own HTML file.
export const prerender = false;
export const ssr = false;
EOF

RUN cat > /home/user/capsvelte/src/routes/status/+page.svelte <<'EOF'
<h1>Runtime Status: READY</h1>
<p>This page is rendered on the client inside the webview.</p>
EOF

RUN cat > /home/user/capsvelte/.gitignore <<'EOF'
node_modules
/build
/dist
/.svelte-kit
EOF

# Install dependencies so the evaluation environment is network-free at task time.
RUN cd /home/user/capsvelte && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="SvelteKit (adapter-auto) + Capacitor project with a mismatched webDir, to be converted into a static, SPA-fallback bundle whose dist/ aligns with capacitor.config.ts webDir. Includes headless browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for the SvelteKit / Capacitor CLI task environment
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libraries
#   - extra pip3 packages for tests: requests, pytest-xprocess
#   - /home/user/capsvelte: SvelteKit project using @sveltejs/adapter-auto with node_modules pre-installed
#   - /home/user/capsvelte/capacitor.config.ts: Capacitor config with a deliberately mismatched webDir ('www')
#   - /home/user/capsvelte/src/routes/+page.(svelte|js): prerendered home page ("Capacitor SvelteKit Home")
#   - /home/user/capsvelte/src/routes/status/+page.(svelte|js): client-only status page ("Runtime Status: READY")

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
