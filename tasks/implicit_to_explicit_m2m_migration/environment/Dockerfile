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
LABEL Description="Prisma project with implicit M2M between Post and Tag; 2 post-tag links seeded. Agent must migrate to explicit PostTag model."

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
const s = fs.readFileSync('prisma/schema.prisma','utf8'); \
const models = \`\nmodel User {\n  id    Int    @id @default(autoincrement())\n  email String @unique\n  name  String?\n  posts Post[]\n}\n\nmodel Post {\n  id       Int    @id @default(autoincrement())\n  title    String\n  authorId Int\n  author   User   @relation(fields: [authorId], references: [id])\n  tags     Tag[]\n}\n\nmodel Tag {\n  id    Int    @id @default(autoincrement())\n  name  String @unique\n  posts Post[]\n}\n\`; \
fs.writeFileSync('prisma/schema.prisma', s + models); \
"

RUN npx prisma migrate dev --name init

RUN npx prisma generate

RUN node -e " \
const { PrismaClient } = require('@prisma/client'); \
const p = new PrismaClient(); \
async function seed() { \
  const user = await p.user.create({ data: { email: 'a@a.com', name: 'A' } }); \
  const t1 = await p.tag.create({ data: { name: 'prisma' } }); \
  const t2 = await p.tag.create({ data: { name: 'node' } }); \
  await p.post.create({ data: { title: 'P1', authorId: user.id, tags: { connect: [{ id: t1.id }, { id: t2.id }] } } }); \
  await p.\$disconnect(); \
} \
seed(); \
"

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
