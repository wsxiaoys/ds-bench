FROM ubuntu:24.04

ARG POCHI_VERSION

ENV WASP_TELEMETRY_DISABLE=1
ENV DEBIAN_FRONTEND=noninteractive

# Base packages, Node.js 20, PostgreSQL 16, Wasp CLI, Pochi CLI and Python deps.
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        postgresql postgresql-contrib && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -sSL https://get.wasp.sh/installer.sh | sh -s -- -v 0.16.7 && \
    ln -s /root/.local/bin/wasp /usr/local/bin/wasp && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Configure the local PostgreSQL server: trust auth on the loopback interface,
# a 'postgres' superuser password and an empty 'taskvault' database. The data
# directory is baked into the image and re-started at container runtime.
RUN printf '%s\n' \
        "local   all   all                trust" \
        "host    all   all   127.0.0.1/32 trust" \
        "host    all   all   ::1/128      trust" \
        > /etc/postgresql/16/main/pg_hba.conf && \
    pg_ctlcluster 16 main start && \
    su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" && \
    su postgres -c "psql -c \"CREATE DATABASE taskvault OWNER postgres;\"" && \
    pg_ctlcluster 16 main stop

# Scaffold the starting Wasp project (default 'basic' template) that still uses SQLite.
RUN cd /home/user && \
    wasp new taskvault && \
    rm -rf /home/user/taskvault/src && \
    mkdir -p /home/user/taskvault/src

# schema.prisma: default SQLite backend with a single Task model.
RUN cat > /home/user/taskvault/schema.prisma <<'EOF'
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Task {
  id          Int     @id @default(autoincrement())
  description String
  isDone      Boolean @default(false)
}
EOF

# main.wasp: app declaration with a task list page, operations and a stats API.
RUN cat > /home/user/taskvault/main.wasp <<'EOF'
app taskvault {
  wasp: {
    version: "^0.16.0"
  },
  title: "TaskVault"
}

route RootRoute { path: "/", to: MainPage }
page MainPage {
  component: import { MainPage } from "@src/MainPage"
}

query getTasks {
  fn: import { getTasks } from "@src/queries",
  entities: [Task]
}

action createTask {
  fn: import { createTask } from "@src/actions",
  entities: [Task]
}

api getStats {
  fn: import { getStats } from "@src/apis",
  httpRoute: (GET, "/api/stats"),
  entities: [Task]
}
EOF

RUN cat > /home/user/taskvault/src/queries.js <<'EOF'
export const getTasks = async (args, context) => {
  return context.entities.Task.findMany({ orderBy: { id: 'asc' } })
}
EOF

RUN cat > /home/user/taskvault/src/actions.js <<'EOF'
export const createTask = async ({ description }, context) => {
  return context.entities.Task.create({ data: { description } })
}
EOF

RUN cat > /home/user/taskvault/src/apis.js <<'EOF'
export const getStats = async (req, res, context) => {
  const taskCount = await context.entities.Task.count()
  res.json({ taskCount })
}
EOF

RUN cat > /home/user/taskvault/src/MainPage.jsx <<'EOF'
import React, { useState } from 'react'
import { useQuery, getTasks, createTask } from 'wasp/client/operations'

export const MainPage = () => {
  const { data: tasks, isLoading, error } = useQuery(getTasks)
  const [description, setDescription] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) return
    await createTask({ description })
    setDescription('')
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>TaskVault</h1>
      <form onSubmit={handleSubmit}>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="New task"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {tasks && tasks.map((task) => <li key={task.id}>{task.description}</li>)}
      </ul>
    </div>
  )
}
EOF

# Compile the SQLite project once and generate the initial SQLite migration.
# This warms node_modules / .wasp caches and produces migrations/ with the
# sqlite provider, matching the initial-state expectations.
RUN cd /home/user/taskvault && wasp db migrate-dev --name init

LABEL Author="generate-harbor-tasks"
LABEL Description="Wasp 0.16.7 SQLite project (TaskVault) with a local PostgreSQL 16 server, for migrating SQLite -> PostgreSQL and adding a PgBoss job."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: requests, pytest-xprocess (used by tests)
#   - Node.js 20 (required to build/run the Wasp app)
#   - PostgreSQL 16 server + client, running locally (db: taskvault, user/pass: postgres/postgres, loopback trust auth)
#   - Wasp CLI 0.16.7 (classic .wasp syntax) installed to /root/.local/bin, symlinked into /usr/local/bin
#   - /home/user/taskvault: starting Wasp project using SQLite (Task entity, getTasks/createTask operations, GET /api/stats), with initial SQLite migrations
#   - ENTRYPOINT starts the local PostgreSQL server at container launch

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
