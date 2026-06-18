FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash \
        ffmpeg ripgrep libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm i -g @getpochi/cli agent-browser && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN agent-browser install
RUN pip3 install --break-system-packages pytest-playwright playwright && playwright install chromium

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Next.js task environment with Node.js v24 installed, including the browser verification environment and tRPC v11 dependencies."

RUN cd /home/user && \
    npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --no-turbopack --import-alias "@/*" && \
    cd app && \
    npm install @trpc/server@next @trpc/client@next @trpc/react-query@next @tanstack/react-query@latest

# Container contents:
#   - always required libs: curl ca-certificates git python3 python3-pip python3-pytest bash
#   - Node.js v24 for the Next.js task environment
#   - browser verification dependencies: Pochi CLI, agent-browser, ffmpeg, ripgrep, and more
#   - /home/user/app: Next.js project with tRPC v11 installed

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
