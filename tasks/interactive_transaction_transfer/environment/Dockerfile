FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prisma project with Account model; alice=100, bob=50. Agent must write transfer.js using interactive transaction."

WORKDIR /home/user/myproject

RUN npm init -y && \
    npm install prisma@^6 --save-dev && \
    npm install @prisma/client@^6 && \
    npx prisma init --datasource-provider sqlite && \
    sed -i 's|provider *= *"prisma-client"|provider = "prisma-client-js"|' prisma/schema.prisma && \
    sed -i '/output[[:space:]]*=[[:space:]]*"\.\.\/generated\/prisma"/d' prisma/schema.prisma && \
    echo 'DATABASE_URL="file:./dev.db"' > .env

RUN node -e " \
const fs = require('fs'); \
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8'); \
const model = \`\nmodel Account {\n  id      Int    @id @default(autoincrement())\n  owner   String @unique\n  balance Float\n}\n\`; \
fs.writeFileSync('prisma/schema.prisma', schema + model); \
"

RUN npx prisma migrate dev --name init

RUN npx prisma generate

RUN node -e " \
const { PrismaClient } = require('@prisma/client'); \
const p = new PrismaClient(); \
p.account.createMany({ data: [ \
  { owner: 'alice', balance: 100 }, \
  { owner: 'bob', balance: 50 }, \
]}).then(() => p.\$disconnect()); \
"

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
