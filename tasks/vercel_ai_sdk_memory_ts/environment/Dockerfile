FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf alchemystai && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi
ENV PATH="/root/.pochi/bin:$PATH"

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="generate-harbor-tasks"
LABEL Description="Ubuntu 24.04 + Node.js v24 environment for building a Vercel AI SDK + @alchemystai/aisdk TypeScript CLI that demonstrates cross-session memory."

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (from NodeSource) so the agent can run `npm install` / `tsc` / `node dist/main.js`
#   - Python `alchemystai` SDK so the verifier can perform best-effort memory cleanup before/after the test
#   - /home/user as the work root; the agent will create /home/user/vercel-ai-memory itself
