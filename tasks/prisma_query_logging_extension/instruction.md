# Query Logging Extension

## Background
Prisma Client Extensions can intercept queries via the `query` component, allowing you to add logging, metrics, or caching around any database operation.

## Requirements
Write a script that uses a Prisma Client Extension to log every query (operation name and arguments) to a file.

## Implementation Guide
1. Create `/home/user/myproject/logging.js`:
   - Import `PrismaClient` and `fs`
   - Create an extended client:
     ```js
     const xprisma = new PrismaClient().$extends({
       query: {
         $allModels: {
           async $allOperations({ operation, model, args, query }) {
             const result = await query(args);
             fs.appendFileSync('/home/user/myproject/query.log',
               JSON.stringify({ model, operation, args }) + '\n');
             return result;
           }
         }
       }
     });
     ```
   - Run 3 queries: `xprisma.user.findMany()`, `xprisma.user.count()`, `xprisma.user.findFirst()`
   - After all queries, read `query.log` and write the number of logged lines to `/home/user/myproject/logging_result.json` as `{ "loggedQueries": <count> }`
2. Run: `node logging.js`

## Constraints
- Project path: `/home/user/myproject`
- Log file: `/home/user/myproject/query.log`
- Output file: `/home/user/myproject/logging_result.json`
