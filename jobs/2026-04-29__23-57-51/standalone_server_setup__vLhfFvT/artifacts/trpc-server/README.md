# Standalone tRPC Server

A minimal tRPC v11 server using the standalone HTTP adapter.

## Project Structure

```
/home/user/project/
├── server.ts       # tRPC router and server entry point
├── tsconfig.json   # TypeScript configuration
└── package.json    # Node.js project manifest
```

## Setup

```bash
cd /home/user/project
npm install
```

## Start

```bash
npx ts-node server.ts
# → tRPC server listening on http://localhost:3000
```

## Usage

Query the `greet` procedure via HTTP GET:

```bash
curl "http://localhost:3000/greet?input=%7B%22name%22%3A%22World%22%7D"
# → {"result":{"data":{"greeting":"Hello, World"}}}
```

## Dependencies

| Package            | Role                              |
|--------------------|-----------------------------------|
| `@trpc/server@next`| tRPC server runtime (v11)         |
| `zod`              | Input schema validation           |
| `typescript`       | TypeScript compiler               |
| `ts-node`          | Run TypeScript directly with Node |
| `@types/node`      | Node.js type definitions          |
