# Wasp ships only a linux/x86_64 binary (no linux/arm64 build), so the image must
# target amd64 to keep the `wasp` CLI working on every host.
FROM --platform=linux/amd64 ubuntu:24.04

ARG POCHI_VERSION

# Disable Wasp telemetry so no network calls are attempted at build or grading time.
ENV WASP_TELEMETRY_DISABLE=1

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    npm i -g @wasp.sh/wasp-cli@0.24.0 && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a minimal Wasp (0.24, Wasp Spec) project that we then customise into
# the task's initial state.
RUN cd /home/user && wasp new taskhub -t minimal

# Wasp Spec config: username/password auth enabled, a relational data model, and
# NO database seeding wired up yet (adding it is the task).
RUN cat > /home/user/taskhub/main.wasp.ts <<'EOF'
import { app, page, route } from "@wasp.sh/spec"
import { MainPage } from "./src/MainPage" with { type: "ref" }
import { LoginPage, SignupPage } from "./src/pages/auth" with { type: "ref" }

export default app({
  name: "taskhub",
  wasp: {
    version: "^0.24",
  },
  title: "TaskHub",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
  ],
})
EOF

# Relational data model: User -> Project -> Task. The unique constraints make an
# idempotent seed implementation meaningful.
RUN cat > /home/user/taskhub/schema.prisma <<'EOF'
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id       Int       @id @default(autoincrement())
  projects Project[]
}

model Project {
  id     Int    @id @default(autoincrement())
  name   String
  user   User   @relation(fields: [userId], references: [id])
  userId Int
  tasks  Task[]

  @@unique([userId, name])
}

model Task {
  id          Int     @id @default(autoincrement())
  description String
  isDone      Boolean @default(false)
  project     Project @relation(fields: [projectId], references: [id])
  projectId   Int

  @@unique([projectId, description])
}
EOF

# Client pages required by the Wasp Spec above.
RUN mkdir -p /home/user/taskhub/src/pages && \
    cat > /home/user/taskhub/src/MainPage.tsx <<'EOF'
export function MainPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>TaskHub</h1>
      <p>A tiny project & task manager.</p>
    </div>
  )
}
EOF

RUN cat > /home/user/taskhub/src/pages/auth.tsx <<'EOF'
import { LoginForm, SignupForm } from "wasp/client/auth"

export function LoginPage() {
  return <LoginForm />
}

export function SignupPage() {
  return <SignupForm />
}
EOF

# Pre-warm the toolchain: install node deps, generate the Prisma client, and
# create the initial migration + local SQLite database. This makes later
# `wasp db seed` / `wasp db migrate-dev` runs work without network access.
RUN cd /home/user/taskhub && wasp db migrate-dev --name init

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.24 (Wasp Spec) TaskHub project with username/password auth and a User/Project/Task model, ready for a database-seeding task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (Wasp 0.24 requires Node.js >= 24.14.1)
#   - Wasp CLI pinned to @wasp.sh/wasp-cli@0.24.0
#   - /home/user/taskhub: pre-scaffolded Wasp Spec project (auth + User/Project/Task model, migrated local SQLite DB, no seeds yet)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
