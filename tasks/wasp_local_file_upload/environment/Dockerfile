# Wasp ships only a linux/amd64 (x86-64) Haskell binary via its installer, so the
# image must be amd64 (runs natively on amd64 hosts and under emulation on arm64).
FROM --platform=linux/amd64 ubuntu:24.04

ARG POCHI_VERSION
ARG WASP_VERSION=0.16.3

# Wasp installer places its binary in $HOME/.local/bin; make it discoverable.
ENV PATH="/root/.local/bin:${PATH}"
ENV WASP_TELEMETRY_DISABLE=1
ENV CI=1

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        libgmp10 xz-utils && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -sSL https://get.wasp.sh/installer.sh | sh -s -- -v ${WASP_VERSION} && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a runnable Wasp project from the bundled "basic" template (the default,
# local template) and replace its source with a clean baseline that already has
# username & password authentication configured.
RUN cd /home/user && \
    wasp new fileupload -t basic && \
    rm -rf /home/user/fileupload/src && \
    mkdir -p /home/user/fileupload/src

RUN cat > /home/user/fileupload/main.wasp <<'WASP'
app fileupload {
  wasp: {
    version: "^0.16.0"
  },
  title: "File Upload",
  auth: {
    userEntity: User,
    methods: {
      usernameAndPassword: {}
    },
    onAuthFailedRedirectTo: "/login"
  }
}

route RootRoute { path: "/", to: MainPage }
page MainPage {
  authRequired: true,
  component: import { MainPage } from "@src/MainPage"
}

route LoginRoute { path: "/login", to: LoginPage }
page LoginPage {
  component: import { LoginPage } from "@src/LoginPage"
}

route SignupRoute { path: "/signup", to: SignupPage }
page SignupPage {
  component: import { SignupPage } from "@src/SignupPage"
}
WASP

RUN cat > /home/user/fileupload/schema.prisma <<'PRISMA'
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id Int @id @default(autoincrement())
}
PRISMA

RUN cat > /home/user/fileupload/src/MainPage.tsx <<'TSX'
export function MainPage() {
  return (
    <div>
      <h1>My Files</h1>
      <p>Upload and manage your files.</p>
    </div>
  )
}
TSX

RUN cat > /home/user/fileupload/src/LoginPage.tsx <<'TSX'
import { LoginForm } from 'wasp/client/auth'
import { Link } from 'react-router-dom'

export function LoginPage() {
  return (
    <div>
      <LoginForm />
      <span>
        I don't have an account yet (<Link to="/signup">go to signup</Link>).
      </span>
    </div>
  )
}
TSX

RUN cat > /home/user/fileupload/src/SignupPage.tsx <<'TSX'
import { SignupForm } from 'wasp/client/auth'
import { Link } from 'react-router-dom'

export function SignupPage() {
  return (
    <div>
      <SignupForm />
      <span>
        I already have an account (<Link to="/login">go to login</Link>).
      </span>
    </div>
  )
}
TSX

# Compile the Wasp spec, generate the SDK, install dependencies and create the
# initial database migration. This validates the scaffold at build time and
# leaves the project ready for `wasp start`.
RUN cd /home/user/fileupload && \
    wasp db migrate-dev --name init

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16 file-upload task: runnable Wasp app with username & password auth and local SQLite at /home/user/fileupload."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - extra apt packages: libgmp10 xz-utils (runtime deps for the Wasp Haskell binary)
#   - always required pip3 packages: pytest-json-ctrf
#   - extra pip3 packages: requests, pytest-xprocess (used by the final-state tests)
#   - Node.js v20 (required by Wasp) installed via NodeSource
#   - Wasp CLI 0.16.3 installed via the official installer (binary on PATH at /root/.local/bin/wasp)
#   - /home/user/fileupload: scaffolded, runnable Wasp app with username & password auth,
#     local SQLite (schema.prisma) and an initial migration; the file-upload feature is
#     intentionally NOT implemented (that is the task).

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
