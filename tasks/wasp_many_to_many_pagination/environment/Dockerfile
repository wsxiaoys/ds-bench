FROM ubuntu:24.04

ARG POCHI_VERSION

# ---------------------------------------------------------------------------
# Base tooling: system packages, Node.js 20, Pochi CLI, PostgreSQL, Python deps
# ---------------------------------------------------------------------------
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        procps postgresql postgresql-contrib && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests psycopg2-binary pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Install the Wasp CLI (pinned) and expose it on PATH.
# ---------------------------------------------------------------------------
RUN curl -sSL https://get.wasp.sh/installer.sh | sh -s -- -v 0.16.2 && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Configure a local PostgreSQL role/database for the app and allow local
# TCP connections without a password (trust) for deterministic offline use.
# ---------------------------------------------------------------------------
RUN pg_ctlcluster 16 main start && \
    su postgres -c "psql -c \"CREATE ROLE wasp WITH LOGIN SUPERUSER PASSWORD 'wasp';\"" && \
    su postgres -c "psql -c \"CREATE DATABASE blog OWNER wasp;\"" && \
    echo "host all all 127.0.0.1/32 trust" >> /etc/postgresql/16/main/pg_hba.conf && \
    echo "host all all ::1/128 trust" >> /etc/postgresql/16/main/pg_hba.conf && \
    pg_ctlcluster 16 main stop

# Fixed, local (non-secret) configuration for the bundled PostgreSQL instance
# and to keep the Wasp CLI from attempting network telemetry when offline.
ENV DATABASE_URL=postgresql://wasp:wasp@localhost:5432/blog
ENV WASP_TELEMETRY_DISABLE=1

# ---------------------------------------------------------------------------
# Scaffold the minimal Wasp app, point it at PostgreSQL, and warm all the
# dependency/build caches (npm install + prisma generate + client/server
# build) so the task and its verification can run fully offline.
# ---------------------------------------------------------------------------
RUN cd /home/user && \
    wasp new blog -t minimal && \
    cd blog && \
    sed -i 's/provider *= *"sqlite"/provider = "postgresql"/' schema.prisma && \
    printf 'DATABASE_URL=postgresql://wasp:wasp@localhost:5432/blog\n' > .env.server && \
    export DATABASE_URL=postgresql://wasp:wasp@localhost:5432/blog && \
    export WASP_TELEMETRY_DISABLE=1 && \
    pg_ctlcluster 16 main start && \
    (wasp db migrate-dev --name init < /dev/null > /tmp/wasp_migrate_warm.log 2>&1 || true) && \
    (wasp start > /tmp/wasp_start_warm.log 2>&1 &) && \
    ( for i in $(seq 1 300); do \
          if curl -s -o /dev/null http://127.0.0.1:3001/ ; then break; fi; \
          sleep 1; \
      done ) ; \
    pkill -f wasp || true ; \
    pkill -f node || true ; \
    pg_ctlcluster 16 main stop || true ; \
    true

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16.2 (React/Node/Prisma) app scaffold at /home/user/blog with a local PostgreSQL database, warmed for offline builds; task is to model a Post<->Tag many-to-many relation and implement a filtered/paginated getPosts Query."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - extra apt packages: procps, postgresql, postgresql-contrib
#   - Node.js v20 (required by Wasp 0.16.2)
#   - Wasp CLI v0.16.2 installed to /root/.local/bin/wasp (symlinked to /usr/local/bin/wasp)
#   - extra pip3 packages: requests, psycopg2-binary, pytest-xprocess (used by the tests)
#   - local PostgreSQL 16 with role 'wasp'/db 'blog' and trust auth on loopback
#   - /home/user/blog: scaffolded Wasp app (minimal template) configured for PostgreSQL,
#       with warmed .wasp/out dependency and build caches for offline execution

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
