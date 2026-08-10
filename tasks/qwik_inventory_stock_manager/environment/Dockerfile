FROM ubuntu:24.04

ARG POCHI_VERSION

# Base tooling, Node.js 20, build toolchain (for native better-sqlite3), and Pochi CLI.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        build-essential sqlite3 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold an empty Qwik City app and install dependencies (including better-sqlite3).
RUN cd /home/user && \
    CI=true npm create qwik@latest empty inventory-app --yes --no-git --no-install && \
    cd inventory-app && \
    npm install && \
    npm install better-sqlite3 && \
    npm install --save-dev @types/better-sqlite3 && \
    mkdir -p /home/user/inventory-app/data

# Create and seed the local SQLite database (ledger-only stock model).
RUN sqlite3 /home/user/inventory-app/data/inventory.db <<'SQL'
CREATE TABLE products (
  id   INTEGER PRIMARY KEY,
  sku  TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);
CREATE TABLE stock_movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO products (id, sku, name) VALUES
  (1, 'WIDGET-A', 'Widget A'),
  (2, 'GADGET-B', 'Gadget B'),
  (3, 'GIZMO-C', 'Gizmo C'),
  (4, 'BOLT-D', 'Bolt D');
INSERT INTO stock_movements (product_id, delta, reason) VALUES
  (1, 100, 'seed'),
  (2, 50, 'seed'),
  (3, 10, 'seed'),
  (4, 60, 'seed');
SQL

LABEL Author="generate-harbor-tasks"
LABEL Description="Qwik City inventory app scaffold with a seeded local SQLite ledger database in /home/user/inventory-app."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - extra apt packages: build-essential, sqlite3 (native module build + DB seeding)
#   - extra pip3 packages: requests, pytest-xprocess (final-state HTTP tests + long-running dev server)
#   - Node.js v20 for the Qwik City app
#   - /home/user/inventory-app: scaffolded empty Qwik City project with better-sqlite3 installed
#   - /home/user/inventory-app/data/inventory.db: seeded SQLite ledger (products + stock_movements)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
