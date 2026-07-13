FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK project at /home/user/app and install its dependencies.
# create-rwsdk downloads the latest release tarball and extracts it into the target dir.
RUN cd /home/user && \
    npx --yes create-rwsdk@latest app --force && \
    cd /home/user/app && \
    npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK task environment with Node.js v22 and a scaffolded rwsdk project at /home/user/app for building a Server-Sent Events endpoint."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - verification pip3 packages: pytest-xprocess, requests
#   - Node.js v22 for the RedwoodSDK (Vite/Cloudflare Workers) task environment
#   - /home/user/app: freshly scaffolded RedwoodSDK project with dependencies installed

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
