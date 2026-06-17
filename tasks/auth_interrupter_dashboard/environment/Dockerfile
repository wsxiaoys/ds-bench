FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 \
        libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 \
        libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 \
        libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 \
        libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 \
        libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm i -g agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages \
        pytest-json-ctrf pochi-verifier pytest-xprocess requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-scaffold the RedwoodSDK starter project at /home/user/myproject.
# We pin to the v1.2.11 release asset to keep image builds deterministic;
# this matches what `npx create-rwsdk` would download from GitHub.
RUN cd /tmp && \
    curl -fsSL -o rwsdk-starter.tar.gz \
        "https://github.com/redwoodjs/sdk/releases/download/v1.2.11/starter-v1.2.11.tar.gz" && \
    mkdir -p /home/user/myproject && \
    tar -xzf rwsdk-starter.tar.gz -C /home/user/myproject --strip-components=0 && \
    rm rwsdk-starter.tar.gz && \
    ls /home/user/myproject

# Pre-install npm dependencies so the dev server can start without a network round-trip.
RUN cd /home/user/myproject && \
    npm install --no-audit --no-fund --loglevel=error

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK (rwsdk) v1.2.11 starter pre-installed at /home/user/myproject with Node.js v24 and browser-verification deps for the auth_interrupter_dashboard task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#       + browser-verification system libs (ffmpeg, libnss3, etc.)
#   - pip3 packages: pytest-json-ctrf pochi-verifier pytest-xprocess requests
#   - Node.js v24 (NodeSource) + agent-browser (browsers installed)
#   - /home/user/myproject: RedwoodSDK starter (v1.2.11) with `node_modules/` pre-installed
#   - SESSION_SECRET is supplied at runtime via envs.json (not baked into the image)
