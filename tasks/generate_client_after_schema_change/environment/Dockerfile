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
LABEL Description="Prisma project with User model and SQLite; Post model absent — agent must add it and run prisma generate."

WORKDIR /home/user/myproject

# Initialize npm project, install Prisma, init with SQLite
RUN npm init -y && \
    npm install prisma@^6 --save-dev && \
    npm install @prisma/client@^6 && \
    npx prisma init --datasource-provider sqlite && \
    sed -i 's|provider *= *"prisma-client"|provider = "prisma-client-js"|' prisma/schema.prisma && \
    sed -i '/output[[:space:]]*=[[:space:]]*"\.\.\/generated\/prisma"/d' prisma/schema.prisma && \
    echo 'DATABASE_URL="file:./dev.db"' > .env

# Add User model to schema
RUN node -e " \
const fs = require('fs'); \
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8'); \
const model = \`\nmodel User {\n  id    Int     @id @default(autoincrement())\n  email String  @unique\n  name  String?\n}\n\`; \
fs.writeFileSync('prisma/schema.prisma', schema + model); \
"

# Run initial migration so schema is in sync with DB
RUN npx prisma migrate dev --name init

# Container contents:
#   - Node.js 20, Prisma installed in /home/user/myproject
#   - prisma/schema.prisma: SQLite datasource + User model (no Post model)
#   - prisma/migrations: initial migration applied
#   - prisma/dev.db: SQLite database

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
