# Prisma Express Rest Api

Build a production-ready REST API for a task management system using Prisma ORM, Express.js, and SQLite.

Project path: `/home/user/myproject`. Express and Prisma are pre-installed.

Define the schema and run migrations for:
- `User`: id, email (unique), name
- `Task`: id, title, description (optional), status String @default('todo'), priority Int @default(0), userId (FK to User), createdAt DateTime @default(now()), updatedAt DateTime @updatedAt

Build `server.js` on port 3000 with full CRUD for tasks:
- `POST /users` — create user (body: `{ email, name }`)
- `POST /tasks` — create task (body: `{ title, description, userId, priority }`)
- `GET /tasks` — list all tasks, supports `?status=todo` filter and `?userId=<id>` filter
- `GET /tasks/:id` — get single task with user included
- `PATCH /tasks/:id` — update task fields (body: any subset of title/description/status/priority)
- `DELETE /tasks/:id` — delete task, returns 204

Start command: `node server.js`
Port: 3000
Project path: `/home/user/myproject`
