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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a fresh RedwoodSDK project at /home/user/myapp and install dependencies.
RUN cd /home/user && \
    npx -y create-rwsdk@latest myapp -f && \
    cd myapp && \
    npm install --no-audit --no-fund

LABEL Author="generate-harbor-tasks"
LABEL Description="RedwoodSDK app wrapping app.fetch in a try/catch error handler"

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - apt: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - pip3: pytest-json-ctrf pochi-verifier requests pytest-xprocess
#   - Node.js v24 + npm
#   - Pre-scaffolded RedwoodSDK project at /home/user/myapp (npm install completed)
#   - Browser verification deps: pochi-verifier, agent-browser, ffmpeg, X11 libs
