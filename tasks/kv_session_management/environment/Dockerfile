FROM ubuntu:24.04

# Base system: apt packages + Node.js v24 + Python helpers.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# User home directory for the task.
RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK project at /home/user/myproject and
# pre-install all npm dependencies so the dev server starts fast and
# offline during evaluation. `create-rwsdk create` is the subcommand
# that accepts a project name; `-f` forces non-interactive overwrite.
# Git is configured with placeholder identity so any post-scaffold
# `git init`/`git commit` triggered by the template will succeed.
RUN git config --global user.email "task@example.com" && \
    git config --global user.name "task" && \
    git config --global init.defaultBranch main && \
    cd /home/user && \
    npx --yes create-rwsdk@latest create myproject -f && \
    cd /home/user/myproject && \
    npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK kv_session_management task environment: Ubuntu 24.04, Node.js v24, pre-scaffolded rwsdk project at /home/user/myproject with npm deps preinstalled. Sessions backed by miniflare KV; no Cloudflare account required."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - Node.js v24 (via NodeSource) for running `npm run dev` (rwsdk + Vite + workerd/miniflare)
#   - pip3 packages: pytest-json-ctrf, requests (HTTP verification), pytest-xprocess (start `npm run dev`)
#   - /home/user/myproject: freshly scaffolded RedwoodSDK project with node_modules pre-installed
#   - KV: provided by miniflare locally; no Cloudflare account, account ID, or API token needed
