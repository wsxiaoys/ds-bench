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
LABEL Description="Prisma project with 10 pre-seeded users (5 @old.com, 5 @keep.com); agent must write batch.js using $transaction to delete+create."

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
const model = \`\nmodel User {\n  id    Int     @id @default(autoincrement())\n  email String  @unique\n  name  String?\n}\n\`; \
fs.writeFileSync('prisma/schema.prisma', schema + model); \
"

RUN npx prisma migrate dev --name init

RUN npx prisma generate

RUN node -e " \
const { PrismaClient } = require('@prisma/client'); \
const p = new PrismaClient(); \
p.user.createMany({ data: [ \
  { email: 'old1@old.com', name: 'Old1' }, \
  { email: 'old2@old.com', name: 'Old2' }, \
  { email: 'old3@old.com', name: 'Old3' }, \
  { email: 'old4@old.com', name: 'Old4' }, \
  { email: 'old5@old.com', name: 'Old5' }, \
  { email: 'keep1@keep.com', name: 'Keep1' }, \
  { email: 'keep2@keep.com', name: 'Keep2' }, \
  { email: 'keep3@keep.com', name: 'Keep3' }, \
  { email: 'keep4@keep.com', name: 'Keep4' }, \
  { email: 'keep5@keep.com', name: 'Keep5' }, \
]}).then(() => p.\$disconnect()); \
"

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
