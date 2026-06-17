# Convex Node Runtime Action

## Background
Convex provides V8 and Node.js runtimes. By default, queries and mutations run in V8, which does not support Node-specific libraries like `crypto` or `fs`. To use these libraries, you must use an Action with the `"use node";` directive.

## Requirements
- Initialize a Convex project in `/home/user/project`.
- Create an Action named `generate` in `convex/hash.ts`.
- The Action must accept a single string argument `text`.
- The Action must compute the SHA-256 hash of the `text` using Node's `crypto` module and return it as a hex string.
- Deploy the Convex project to the cloud.

## Implementation Hints
- Ensure you set `"use node";` at the top of your `convex/hash.ts` file.
- Use `crypto.createHash('sha256').update(text).digest('hex')` to compute the hash.
- Ensure you deploy the project using `npx convex deploy`.

## Acceptance Criteria
- Project path: `/home/user/project`
- Ensure the real deployment action is executed.
- The deployed Convex backend must expose an action `api.hash.generate` (or `hash:generate`).
- The action must take an argument `{ text: string }` and return the SHA-256 hash in hex format.

