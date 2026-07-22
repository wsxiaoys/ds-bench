FROM ubuntu:24.04

ARG POCHI_VERSION
ARG WASP_VERSION=0.16.2

# System packages, Node.js 20, Pochi CLI, Wasp CLI, and Python test deps.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -sSL https://get.wasp.sh/installer.sh | bash -s -- -v ${WASP_VERSION} && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold the base Wasp project (default TypeScript template).
RUN cd /home/user && wasp new bankapp

# Wasp app configuration: SQLite, a public MainPage, and an idempotent dev seed.
# NOTE: the money-transfer Action is intentionally NOT declared here; the agent
# must add it.
RUN cat > /home/user/bankapp/main.wasp <<'EOF'
app bankapp {
  wasp: {
    version: "^0.16.0"
  },
  title: "bankapp",
  db: {
    seeds: [
      import { devSeed } from "@src/dbSeeds"
    ]
  }
}

route RootRoute { path: "/", to: MainPage }
page MainPage {
  component: import { MainPage } from "@src/MainPage"
}
EOF

# Data model: bank accounts and a ledger of transfers between them.
RUN cat > /home/user/bankapp/schema.prisma <<'EOF'
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Account {
  id       Int           @id @default(autoincrement())
  name     String        @unique
  balance  Int           @default(0)
  sent     LedgerEntry[] @relation("sentTransfers")
  received LedgerEntry[] @relation("receivedTransfers")
}

model LedgerEntry {
  id            Int      @id @default(autoincrement())
  amount        Int
  createdAt     DateTime @default(now())
  fromAccount   Account  @relation("sentTransfers", fields: [fromAccountId], references: [id])
  fromAccountId Int
  toAccount     Account  @relation("receivedTransfers", fields: [toAccountId], references: [id])
  toAccountId   Int
}
EOF

# Placeholder homepage.
RUN cat > /home/user/bankapp/src/MainPage.tsx <<'EOF'
export const MainPage = () => {
  return (
    <div>
      <h1>bankapp</h1>
      <p>A minimal bank account ledger.</p>
    </div>
  )
}
EOF

# Idempotent development seed: clears the ledger and resets the two sample
# accounts (Alice = 100, Bob = 50) so tests always start from a known state.
RUN cat > /home/user/bankapp/src/dbSeeds.ts <<'EOF'
export const devSeed = async (prisma: any) => {
  await prisma.ledgerEntry.deleteMany({})
  const accounts: Array<[string, number]> = [
    ["Alice", 100],
    ["Bob", 50],
  ]
  for (const [name, balance] of accounts) {
    await prisma.account.upsert({
      where: { name },
      update: { balance },
      create: { name, balance },
    })
  }
}
EOF

# Pre-install the generated app's dependencies and create + apply the initial
# database migration so the environment is ready to run offline.
RUN cd /home/user/bankapp && \
    rm -f src/MainPage.jsx && \
    wasp db migrate-dev --name init

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16 full-stack app (bankapp) with SQLite, Account/LedgerEntry models, and a dev seed; the atomic transferFunds Action is left for the agent to implement."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v20 (required to build/run the generated Wasp app)
#   - Wasp CLI v0.16.2 (installed to /root/.local/bin, symlinked into /usr/local/bin)
#   - pip3 packages for verification: requests, pytest-xprocess
#   - /home/user/bankapp: pre-scaffolded Wasp project (SQLite) with:
#       * main.wasp     - app config, root page, and dev seed registration (no transfer Action yet)
#       * schema.prisma - Account and LedgerEntry models
#       * src/MainPage.tsx, src/dbSeeds.ts
#       * migrations/ + installed deps from `wasp db migrate-dev`

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
