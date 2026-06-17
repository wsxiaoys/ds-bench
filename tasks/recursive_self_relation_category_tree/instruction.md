# Recursive Self Relation Category Tree

## Background
Prisma supports self-referential relations (a model that relates to itself), which are used to model tree structures like categories, organizational hierarchies, or nested comments.

## Requirements
Add a self-referential `Category` model, migrate, build a 3-level category tree, and query it with nested includes.

## Implementation Guide
1. Add to `prisma/schema.prisma`:
   ```prisma
   model Category {
     id         Int        @id @default(autoincrement())
     name       String
     parentId   Int?
     parent     Category?  @relation("CategoryTree", fields: [parentId], references: [id])
     children   Category[] @relation("CategoryTree")
   }
   ```
2. Run: `npx prisma migrate dev --name add_category`
3. Create `/home/user/myproject/tree.js`:
   - Create root: `{ name: 'Electronics' }`
   - Create child: `{ name: 'Phones', parentId: <root.id> }`
   - Create grandchild: `{ name: 'Smartphones', parentId: <child.id> }`
   - Query root with:
     ```js
     prisma.category.findFirst({
       where: { name: 'Electronics' },
       include: { children: { include: { children: true } } }
     })
     ```
   - Write result to `/home/user/myproject/tree_result.json`
4. Run: `node tree.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/tree_result.json`
