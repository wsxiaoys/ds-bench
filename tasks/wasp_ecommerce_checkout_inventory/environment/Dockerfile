FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

# Install system dependencies, PostgreSQL, and browser-verification packages
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep sudo \
        postgresql postgresql-contrib \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js v24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Wasp CLI (v0.24.0) globally
RUN npm install -g @wasp.sh/wasp-cli@0.24.0

# Install Pochi CLI, Agent Browser, and Python verifier dependencies
RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess

# Setup PostgreSQL database and roles
RUN service postgresql start && \
    su - postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" && \
    su - postgres -c "createdb wasp_db"

# Create /home/user directory
RUN mkdir -p /home/user && chmod 0755 /home/user

# Initialize Wasp app using template
RUN cd /home/user && \
    wasp new app --template minimal && \
    cd app && \
    wasp install

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp.sh v0.24.0 e-commerce checkout inventory task environment with Node.js v24, PostgreSQL, and browser-agent verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Ubuntu 24.04 base
#   - Node.js v24 and global @wasp.sh/wasp-cli@0.24.0
#   - PostgreSQL database server (configured with wasp_db database)
#   - Pochi CLI, agent-browser, and pochi-verifier for browser checks
#   - Pre-seeded minimal Wasp application in /home/user/app with dependencies pre-installed

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
