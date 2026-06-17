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
LABEL Description="Prisma project with 5 accumulated migrations; agent must squash them into a single baseline migration."

WORKDIR /home/user/myproject

RUN npm init -y && \
    npm install prisma@^6 --save-dev && \
    npm install @prisma/client@^6 && \
    npx prisma init --datasource-provider sqlite && \
    sed -i 's|provider *= *"prisma-client"|provider = "prisma-client-js"|' prisma/schema.prisma && \
    sed -i '/output[[:space:]]*=[[:space:]]*"\.\.\/generated\/prisma"/d' prisma/schema.prisma && \
    echo 'DATABASE_URL="file:./dev.db"' > .env

# Build up 5 migrations incrementally
RUN node -e " \
const fs = require('fs'); \
const s = fs.readFileSync('prisma/schema.prisma','utf8'); \
fs.writeFileSync('prisma/schema.prisma', s + '\nmodel User {\n  id Int @id @default(autoincrement())\n  email String @unique\n}\n'); \
" && npx prisma migrate dev --name m1_add_user

RUN node -e " \
const fs = require('fs'); \
let s = fs.readFileSync('prisma/schema.prisma','utf8'); \
s = s.replace('email String @unique', 'email String @unique\n  name String?'); \
fs.writeFileSync('prisma/schema.prisma', s); \
" && npx prisma migrate dev --name m2_add_name

RUN node -e " \
const fs = require('fs'); \
const s = fs.readFileSync('prisma/schema.prisma','utf8'); \
fs.writeFileSync('prisma/schema.prisma', s + '\nmodel Post {\n  id Int @id @default(autoincrement())\n  title String\n  authorId Int\n  author User @relation(fields: [authorId], references: [id])\n}\n'); \
" && node -e " \
const fs = require('fs'); \
let s = fs.readFileSync('prisma/schema.prisma','utf8'); \
s = s.replace('name String?', 'name String?\n  posts Post[]'); \
fs.writeFileSync('prisma/schema.prisma', s); \
" && npx prisma migrate dev --name m3_add_post

RUN node -e " \
const fs = require('fs'); \
let s = fs.readFileSync('prisma/schema.prisma','utf8'); \
s = s.replace('title String', 'title String\n  published Boolean @default(false)'); \
fs.writeFileSync('prisma/schema.prisma', s); \
" && npx prisma migrate dev --name m4_add_published

RUN node -e " \
const fs = require('fs'); \
let s = fs.readFileSync('prisma/schema.prisma','utf8'); \
s = s.replace('published Boolean @default(false)', 'published Boolean @default(false)\n  createdAt DateTime @default(now())'); \
fs.writeFileSync('prisma/schema.prisma', s); \
" && npx prisma migrate dev --name m5_add_created_at

RUN npx prisma generate

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
