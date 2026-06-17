# Implicit To Explicit M2M Migration

The project at `/home/user/myproject` currently uses an implicit many-to-many relation between `Post` and `Tag` (Prisma-managed join table `_PostToTag`). Migrate this to an explicit join model `PostTag` that adds a `addedAt DateTime @default(now())` field, without losing existing data.

Project path: `/home/user/myproject`

Steps:
1. Inspect the existing implicit M2M: `Post` has `tags Tag[]` and `Tag` has `posts Post[]`.
2. Create an explicit `PostTag` model:
   ```prisma
   model PostTag {
     postId  Int
     tagId   Int
     addedAt DateTime @default(now())
     post    Post @relation(fields: [postId], references: [id])
     tag     Tag  @relation(fields: [tagId], references: [id])
     @@id([postId, tagId])
   }
   ```
3. Remove the implicit `tags Tag[]` / `posts Post[]` fields and add explicit `postTags PostTag[]` to both `Post` and `Tag`.
4. Run: `npx prisma migrate dev --name implicit_to_explicit_m2m`
5. Write a script `migrate_m2m.js` that:
   - Reads all entries from `_PostToTag` via `$queryRaw`
   - Creates corresponding `PostTag` records
   - Queries `PostTag` count and writes to `/home/user/myproject/m2m_migrate_result.json`: `{ "migratedCount": <count> }`
6. Run: `node migrate_m2m.js`

Output file: `/home/user/myproject/m2m_migrate_result.json`
