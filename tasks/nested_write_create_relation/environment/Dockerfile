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
LABEL Description="Prisma project with User+Post one-to-many schema migrated; agent must write nested.js to create parent+children in one call."

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
const models = \`\nmodel User {\n  id    Int    @id @default(autoincrement())\n  email String @unique\n  name  String?\n  posts Post[]\n}\n\nmodel Post {\n  id       Int    @id @default(autoincrement())\n  title    String\n  authorId Int\n  author   User   @relation(fields: [authorId], references: [id])\n}\n\`; \
fs.writeFileSync('prisma/schema.prisma', schema + models); \
"

RUN npx prisma migrate dev --name init

RUN npx prisma generate

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
