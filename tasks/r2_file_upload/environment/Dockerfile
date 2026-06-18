FROM ubuntu:24.04

# Base OS packages, Python toolchain, Node.js v24, and Python test dependencies.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Pre-warm Cloudflare workerd binaries used by the local rwsdk dev server so the
# first `npm run dev` does not need to download anything at test time.
RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK project at /home/user/myproject and pre-install
# its npm dependencies. The agent will modify wrangler.jsonc and src/worker.tsx
# to add the R2 binding and API routes.
RUN cd /home/user && \
    npx --yes create-rwsdk@latest myproject && \
    cd /home/user/myproject && \
    npm install --no-audit --no-fund && \
    # Trigger initial wrangler / miniflare runtime download so that the first
    # `npm run dev` invocation inside the test does not have to fetch workerd
    # over the network (best-effort; ignored on failure).
    (npx --yes wrangler --version || true)

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK (rwsdk) task environment with Node.js v24 and a pre-scaffolded project at /home/user/myproject for building a Cloudflare R2-backed file upload API."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages used by the verifier: pytest-xprocess, requests
#   - Node.js v24 for the RedwoodSDK dev server (Vite + Miniflare)
#   - /home/user/myproject: a freshly scaffolded RedwoodSDK project (via `npx create-rwsdk@latest`)
#     with `npm install` already run, so node_modules is populated and the agent
#     can start the dev server immediately.
