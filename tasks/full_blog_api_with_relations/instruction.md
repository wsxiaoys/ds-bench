# Full Blog Api With Relations

Build a complete blog REST API using Prisma ORM and Express.js with SQLite.

The project is at `/home/user/myproject`. Node.js and Express are pre-installed.

Define the following schema with migrations:
- `User`: id, email (unique), name
- `Post`: id, title, content (optional), published Boolean @default(false), authorId (FK to User), createdAt DateTime @default(now())
- `Comment`: id, body, postId (FK to Post), authorId (FK to User)

Build an Express server at `server.js` on port 3000 with these endpoints:
- `POST /users` — create user
- `GET /users/:id/posts` — get published posts by user (include comment count)
- `POST /posts` — create post (body: `{ title, content, authorId }`)
- `PATCH /posts/:id/publish` — set `published: true`
- `POST /posts/:id/comments` — add a comment (body: `{ body, authorId }`)
- `GET /posts/:id` — get post with author and comments included

Start the server: `node server.js`
Port: 3000
Project path: `/home/user/myproject`
