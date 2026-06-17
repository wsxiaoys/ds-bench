# Convex Scheduled Cleanup

## Background
Convex allows scheduling recurring functions using cron jobs. In this task, you will create a Convex backend that includes a mutation to clean up expired session data and a cron job to run this mutation automatically.

## Requirements
- Initialize a Convex project in `/home/user/myproject`.
- Create a mutation named `cleanup` in `convex/sessions.ts`.
- The mutation should delete all documents in the table `sessions_${run-id}` where the `expiresAt` field is less than the current time (using `Date.now()`).
- Create a cron job in `convex/crons.ts` that runs the `cleanup` mutation every 1 hour.
- The cron job must be named `cleanup-sessions-${run-id}`.
- The `run-id` must be read from the `ZEALT_RUN_ID` environment variable.
- You must set the `ZEALT_RUN_ID` environment variable in the Convex deployment using the Convex CLI so that it is available at runtime.
- Deploy the Convex functions to the production environment.
- Save the text `Deployment: success` to `/home/user/myproject/output.log` after a successful deployment.

## Implementation Hints
- Use `npx convex deploy` to deploy your functions. It will automatically use the `CONVEX_DEPLOY_KEY` provided in the environment.
- Use `npx convex env set ZEALT_RUN_ID <value>` to set the environment variable in your Convex deployment.
- In your Convex functions and crons, access the environment variable using `process.env.ZEALT_RUN_ID`.
- You can use `ctx.db.query(tableName).filter(q => q.lt(q.field("expiresAt"), Date.now())).collect()` to find expired sessions, and then `ctx.db.delete(doc._id)` to delete them.
- Do not create a strict `schema.ts` to avoid table name validation issues with dynamic table names.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the real deployment action is executed and the log artifact exists.
- Log file: `/home/user/myproject/output.log`
- The log file must contain the exact text `Deployment: success`.
- A Convex mutation `sessions:cleanup` must be deployed.
- A cron job named `cleanup-sessions-${run-id}` must be registered to run every 1 hour.
- When the `sessions:cleanup` mutation is called, it must delete all documents in the `sessions_${run-id}` table where `expiresAt` < `Date.now()`.

