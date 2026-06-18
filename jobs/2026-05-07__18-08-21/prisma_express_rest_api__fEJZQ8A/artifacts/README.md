# Prisma Express REST API - Task Management System

A production-ready REST API for task management using Prisma ORM, Express.js, and SQLite.

## Project Structure

- `prisma/schema.prisma` - Database schema with User and Task models
- `server.js` - Express server with full CRUD API endpoints
- `dev.db` - SQLite database file
- `prisma/migrations/` - Database migrations

## Database Schema

### User Model
- `id`: String (UUID, auto-generated)
- `email`: String (unique)
- `name`: String
- `tasks`: Relation to Task model

### Task Model
- `id`: String (UUID, auto-generated)
- `title`: String
- `description`: String (optional)
- `status`: String (default: "todo")
- `priority`: Integer (default: 0)
- `userId`: String (foreign key to User)
- `user`: Relation to User model
- `createdAt`: DateTime (auto-generated)
- `updatedAt`: DateTime (auto-updated)

## API Endpoints

### Create User
```bash
POST /users
Content-Type: application/json

{
  "email": "john@example.com",
  "name": "John Doe"
}
```

### Create Task
```bash
POST /tasks
Content-Type: application/json

{
  "title": "Complete project",
  "description": "Build the REST API",
  "userId": "user-uuid-here",
  "priority": 1
}
```

### List All Tasks
```bash
GET /tasks
# Optional filters:
GET /tasks?status=todo
GET /tasks?userId=user-uuid-here
GET /tasks?status=todo&userId=user-uuid-here
```

### Get Single Task
```bash
GET /tasks/:id
```

### Update Task
```bash
PATCH /tasks/:id
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "status": "in-progress",
  "priority": 2
}
```

### Delete Task
```bash
DELETE /tasks/:id
# Returns 204 No Content
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run database migrations:
```bash
npx prisma migrate dev --name init
```

3. Start the server:
```bash
node server.js
```

4. Server runs on http://localhost:3000

## Testing the API

### Create a user:
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","name":"John Doe"}'
```

### Create a task:
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Complete project","description":"Build the REST API","userId":"USER_ID_HERE","priority":1}'
```

### List all tasks:
```bash
curl http://localhost:3000/tasks
```

### Get a specific task:
```bash
curl http://localhost:3000/tasks/TASK_ID_HERE
```

### Update a task:
```bash
curl -X PATCH http://localhost:3000/tasks/TASK_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress","priority":2}'
```

### Delete a task:
```bash
curl -X DELETE http://localhost:3000/tasks/TASK_ID_HERE
```

## Features

- ✅ Full CRUD operations for tasks
- ✅ User management
- ✅ Task filtering by status and userId
- ✅ Automatic timestamp management (createdAt, updatedAt)
- ✅ Cascade delete (tasks are deleted when user is deleted)
- ✅ Input validation
- ✅ Error handling
- ✅ Graceful shutdown

## Technology Stack

- **Express.js** - Web framework
- **Prisma ORM** - Database toolkit
- **SQLite** - Database
- **Node.js** - Runtime environment

## Database Management

### View database in Prisma Studio:
```bash
npx prisma studio
```

### Create a new migration:
```bash
npx prisma migrate dev --name migration_name
```

### Reset database:
```bash
npx prisma migrate reset
```

### Generate Prisma Client:
```bash
npx prisma generate
```