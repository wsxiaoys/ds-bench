# Create a Daytona Sandbox with the TypeScript SDK

## Background
Daytona is a SaaS platform that provides secure, ephemeral Linux sandboxes for running untrusted or AI-generated code. The Daytona TypeScript SDK lets you programmatically create, manage, and delete sandboxes against the Daytona cloud API (`https://app.daytona.io/api`).

In this task you will write a small Node.js script that uses the Daytona TypeScript SDK to provision a fresh sandbox, record its ID to a log file, and then clean it up.

## Requirements
- Use the official Daytona TypeScript SDK (`@daytonaio/sdk`) from npm. Do **NOT** call the Daytona REST API directly.
- Authenticate using the `DAYTONA_API_KEY` environment variable (already present in the environment).
- Read `run-id` from `/logs/artifacts/run-id`.
- Create a brand-new sandbox whose `name` is `create-sandbox-ts-${run-id}`.
- After the sandbox is created, write its UUID to `/home/user/myproject/output.log` on a single line with format: `Sandbox ID: <id>`.
- After writing the log, delete the sandbox you just created so it does not consume quota.

## Implementation Hints
- Install the SDK locally inside the project directory (e.g. with `npm init -y` and `npm install @daytonaio/sdk`).
- Initialize the client with `new Daytona()` — it will automatically pick up `DAYTONA_API_KEY` from the environment.
- Use `daytona.create({ name, language: 'typescript', ... })` to create the sandbox. The returned object exposes the sandbox's `id`.
- Use `daytona.delete(sandbox)` (not `remove`) to remove the sandbox at the end.
- Drive the script with `node`. You may use TypeScript with `tsx`/`ts-node` or plain JavaScript — both are acceptable.
