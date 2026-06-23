# Optimistic Concurrency Version Field

## Background
Optimistic concurrency control prevents lost updates when multiple processes modify the same record. A common pattern is a `version` field that is incremented on every update. If the version doesn't match, the update is rejected.

## Requirements
Implement optimistic concurrency on a `Document` model using a `version` field and an interactive transaction.

## Implementation Guide
1. The schema has a `Document` model with `id`, `content String`, `version Int @default(1)`.
2. Create `/home/user/myproject/optimistic.js`:
   - Import `PrismaClient`
   - Read the current document (id=1)
   - Simulate a concurrent update: attempt to update with an **old version** (currentVersion - 1) inside a transaction — the transaction should throw an error or return 0 updated rows
   - Then perform a valid update with the correct version:
     ```js
     await prisma.$transaction(async (tx) => {
       const current = await tx.document.findUnique({ where: { id: 1 } });
       if (current.version !== expectedVersion) throw new Error('Version mismatch');
       await tx.document.update({
         where: { id: 1 },
         data: { content: 'Updated', version: { increment: 1 } }
       });
     });
     ```
   - Write to `/home/user/myproject/optimistic_result.json`:
     `{ "conflictCaught": true, "finalVersion": <version>, "finalContent": "Updated" }`
3. Run: `node optimistic.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/optimistic_result.json`
- Document id=1 starts with `content='Draft'`, `version=1`
