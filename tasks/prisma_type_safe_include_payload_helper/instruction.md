# Type Safe Include Payload Helper

Prisma provides `Prisma.validator` and `Prisma.UserGetPayload` (TypeScript utility types) to create reusable, type-safe include definitions. This task requires implementing a JavaScript helper that validates that a `getUserWithPosts` function returns the correct shape at runtime.

Project at `/home/user/myproject`. Schema has `User` (id, email, name) with `posts Post[]` and `Post` (id, title, authorId).

Create `/home/user/myproject/payload_helper.js`:
1. Define a reusable include config:
   ```js
   const userWithPostsArgs = { include: { posts: true } };
   ```
2. Implement `getUserWithPosts(email)` that calls `prisma.user.findUnique({ where: { email }, ...userWithPostsArgs })`.
3. Create a test user `{ email: 'shape@example.com', name: 'Shape' }` with 2 posts (`{ title: 'Shape Post 1' }`, `{ title: 'Shape Post 2' }`).
4. Call `getUserWithPosts('shape@example.com')`.
5. Validate the returned object shape:
   - Has `id`, `email`, `name` keys
   - Has `posts` array with 2 items, each having `title`
6. Write validation result to `/home/user/myproject/payload_result.json`:
   `{ "shapeValid": true, "postCount": 2 }`

Output file: `/home/user/myproject/payload_result.json`
Project path: `/home/user/myproject`
