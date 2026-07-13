FROM ubuntu:24.04

ARG POCHI_VERSION

# System packages, Node.js v22, Pochi CLI, and Python verification libraries.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK project, install dependencies, and provision the
# shared webhook secret via the project's .env file (RedwoodSDK links .env to
# .dev.vars so it is exposed to the worker as env.WEBHOOK_SECRET at runtime).
RUN cd /home/user && \
    npx -y create-rwsdk webhook-app && \
    cd webhook-app && \
    npm install && \
    printf 'WEBHOOK_SECRET=whsec_zealt_test_secret_key_5f2a9c\n' > /home/user/webhook-app/.env

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK project environment (Node.js v22) for building a signed HMAC-SHA256 webhook receiver."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for the RedwoodSDK task environment
#   - pip3 verification packages: requests, pytest-xprocess
#   - /home/user/webhook-app: scaffolded RedwoodSDK project with dependencies installed
#   - /home/user/webhook-app/.env: provisions WEBHOOK_SECRET for the worker runtime

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
