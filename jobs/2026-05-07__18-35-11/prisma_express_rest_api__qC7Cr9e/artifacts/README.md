# Task Management REST API

## Stack
- **Runtime**: Node.js
- **Framework**: Express.js v5
- **ORM**: Prisma v7
- **Database**: SQLite (via `better-sqlite3` + `@prisma/adapter-better-sqlite3`)

## Project structure
```
myproject/
├── server.js               # Express application (port 3000)
├── prisma/
│   ├── schema.prisma       # Prisma schema (User + Task models)
│   └── migrations/         # SQL migrations
├── prisma.config.ts        # Prisma v7 datasource configuration
├── dev.db                  # SQLite database (auto-created by migration)
└── package.json
```

## Start
```bash
cd /home/user/myproject
node server.js
```

## API Endpoints

| Method | Path          | Body / Query                                    | Description                          |
|--------|---------------|-------------------------------------------------|--------------------------------------|
| POST   | /users        | `{ email, name }`                               | Create a user                        |
| POST   | /tasks        | `{ title, description?, userId, priority? }`    | Create a task                        |
| GET    | /tasks        | `?status=<str>&userId=<int>`                    | List tasks (with optional filters)   |
| GET    | /tasks/:id    | —                                               | Get single task (with user)          |
| PATCH  | /tasks/:id    | any subset of `title/description/status/priority` | Update task fields                |
| DELETE | /tasks/:id    | —                                               | Delete task (returns 204)            |

## Schema

### User
| Field | Type   | Constraints       |
|-------|--------|-------------------|
| id    | Int    | PK, autoincrement |
| email | String | unique            |
| name  | String |                   |

### Task
| Field       | Type     | Constraints            |
|-------------|----------|------------------------|
| id          | Int      | PK, autoincrement      |
| title       | String   |                        |
| description | String?  | optional               |
| status      | String   | default: "todo"        |
| priority    | Int      | default: 0             |
| userId      | Int      | FK → User              |
| createdAt   | DateTime | default: now()         |
| updatedAt   | DateTime | @updatedAt             |
