FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep build-essential && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-scaffold a minimal, bootable Qwik City app (routing included, no demo code)
# and install its dependencies plus a local SQLite driver so the task can be
# completed fully offline. The agent implements the chat API inside this project.
RUN cd /home/user && \
    CI=true npm create qwik@latest empty qwik-chat --yes --no-git --no-install && \
    cd qwik-chat && \
    npm install && \
    npm install better-sqlite3

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City app environment (Node.js 22) pre-scaffolded at /home/user/qwik-chat for building a multi-room SSE chat backend with an in-memory broker and local SQLite."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - build-essential: native toolchain for the local SQLite driver
#   - always required pip3 packages: pytest-json-ctrf
#   - requests: used by tests/test_final_state.py to drive HTTP/SSE checks
#   - Node.js v22 for the Qwik City task environment
#   - /home/user/qwik-chat: pre-scaffolded, bootable Qwik City app (empty starter) with dependencies + better-sqlite3 installed

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
