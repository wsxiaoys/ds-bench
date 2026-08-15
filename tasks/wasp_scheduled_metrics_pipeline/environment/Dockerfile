FROM ubuntu:24.04

ARG POCHI_VERSION

ENV DEBIAN_FRONTEND=noninteractive
ENV WASP_TELEMETRY_DISABLE=1
ENV DATABASE_URL=postgresql://waspuser:wasppass@localhost:5432/waspmetrics

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        gnupg xz-utils procps net-tools locales tzdata \
        postgresql postgresql-client postgresql-contrib \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g npm@11 && \
    npm install -g @wasp.sh/wasp-cli@0.25.0 && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Make the PostgreSQL server binaries globally reachable (Ubuntu keeps them in
# /usr/lib/postgresql/<version>/bin, which is not on PATH by default).
RUN ln -sf /usr/lib/postgresql/16/bin/pg_ctl /usr/local/bin/pg_ctl && \
    ln -sf /usr/lib/postgresql/16/bin/postgres /usr/local/bin/postgres && \
    ln -sf /usr/lib/postgresql/16/bin/initdb /usr/local/bin/initdb

# Create the local database role and database that DATABASE_URL points to.
RUN printf '%s\n' \
        "CREATE ROLE waspuser WITH LOGIN SUPERUSER PASSWORD 'wasppass';" \
        "CREATE DATABASE waspmetrics OWNER waspuser;" > /tmp/init_db.sql && \
    pg_ctlcluster 16 main start && \
    su postgres -c "psql -v ON_ERROR_STOP=1 -f /tmp/init_db.sql" && \
    su postgres -c "psql -v ON_ERROR_STOP=1 -d waspmetrics -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto'" && \
    pg_ctlcluster 16 main stop && \
    rm -f /tmp/init_db.sql

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold the Wasp project the task starts from and warm up its dependencies so
# the first compile inside the container does not have to download everything.
RUN cd /home/user && \
    wasp new waspmetrics -t minimal && \
    cd /home/user/waspmetrics && \
    (wasp compile || true)

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.25.0 task environment with Node.js 24, a local PostgreSQL 16 server, a scaffolded Wasp project at /home/user/waspmetrics, and Playwright/Chromium for browser verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js 24 + npm 11 (Wasp 0.25.0 requires node >= 24.14.1 and npm >= 11.11.0)
#   - Wasp CLI 0.25.0 installed globally via @wasp.sh/wasp-cli
#   - PostgreSQL 16 server + client, with role `waspuser` and database `waspmetrics`
#     reachable through the exported DATABASE_URL (the server itself is NOT running)
#   - browser verification dependencies: playwright (pip) with Chromium and its system libraries
#   - verification python packages: requests, pytest-xprocess, playwright
#   - /home/user/waspmetrics: scaffolded Wasp project (minimal starter template)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
