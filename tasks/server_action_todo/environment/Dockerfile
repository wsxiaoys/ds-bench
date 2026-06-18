FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm i -g agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests pochi-verifier && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK project at /home/user/myproject and pre-install npm deps.
# The scaffold provides a working src/worker.tsx, src/app/document.tsx and a Home page that
# the executor is expected to rewrite to satisfy the task requirements.
RUN cd /home/user && \
    npx --yes create-rwsdk@latest myproject --force && \
    cd /home/user/myproject && \
    npm install --no-audit --no-fund --loglevel=error

# Pre-configure the local Cloudflare KV namespace `TODOS` in wrangler.jsonc so that the
# miniflare dev server exposes env.TODOS to the worker. The executor is still expected to
# wire up the routes, server actions, and storage logic.
RUN <<'BASH'
set -e
cd /home/user/myproject
CONFIG=""
if [ -f wrangler.jsonc ]; then CONFIG="wrangler.jsonc"; fi
if [ -z "$CONFIG" ] && [ -f wrangler.json ]; then CONFIG="wrangler.json"; fi
if [ -z "$CONFIG" ]; then
  echo "No wrangler.jsonc/.json found in scaffolded project." >&2
  exit 1
fi
python3 - "$CONFIG" <<'PY'
import json, re, sys, pathlib
p = pathlib.Path(sys.argv[1])
raw = p.read_text()
# Strip /* */ block comments and // line comments so we can parse as JSON.
no_block = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
no_line = re.sub(r"(^|[^:])//[^\n]*", lambda m: m.group(1), no_block)
cfg = json.loads(no_line)
cfg.setdefault("kv_namespaces", [])
if not any(ns.get("binding") == "TODOS" for ns in cfg["kv_namespaces"]):
    cfg["kv_namespaces"].append({
        "binding": "TODOS",
        "id": "local-todos-namespace"
    })
p.write_text(json.dumps(cfg, indent=2) + "\n")
PY
BASH

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK (rwsdk) task environment with Node.js v24, a scaffolded project at /home/user/myproject, a pre-configured local KV namespace binding TODOS, and browser-verification dependencies."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for the RedwoodSDK (rwsdk) task environment
#   - Browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and shared libs
#   - pip3 test deps: requests, pytest-xprocess (for long-running dev server in final-state tests)
#   - /home/user/myproject: scaffolded rwsdk project with npm dependencies installed
#   - /home/user/myproject/wrangler.jsonc: contains a local KV namespace binding `TODOS`
