# Many To Many Explicit With Metadata

## Background
An explicit many-to-many relation uses a dedicated join table model with extra fields (metadata). This is needed when the relationship itself carries data, such as a `role` field on a `UserProject` join table.

## Requirements
Add explicit M2M between `User` and `Project` via a `UserProject` join model that includes a `role` field, then migrate and query.

## Implementation Guide
1. Add to `prisma/schema.prisma`:
   - `Project` model: `id Int @id @default(autoincrement())`, `name String`
   - `UserProject` join model: `userId Int`, `projectId Int`, `role String`, `user User @relation(...)`, `project Project @relation(...)`, `@@id([userId, projectId])`
   - Add `userProjects UserProject[]` to `User`
   - Add `userProjects UserProject[]` to `Project`
2. Run: `npx prisma migrate dev --name add_project_m2m`
3. Create `/home/user/myproject/explicit_m2m.js`:
   - Create a user `{ email: 'pm@example.com', name: 'PM' }`
   - Create a project `{ name: 'Alpha' }`
   - Create a `UserProject` record linking them with `role: 'admin'`
   - Query the user with `include: { userProjects: { include: { project: true } } }`
   - Write result to `/home/user/myproject/explicit_m2m_result.json`
4. Run: `node explicit_m2m.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/explicit_m2m_result.json`
