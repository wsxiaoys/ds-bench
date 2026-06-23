# tRPC Standalone Server with CORS

## Overview
A standalone tRPC v11 HTTP server with CORS configured to allow requests from `http://localhost:3000`.

## Project Location
`/home/user/project`

## Files
- `code/index.ts` — Main server file
- `code/package.json` — Project manifest

## Start Command
```bash
npx tsx index.ts
```

## Server Details
- **Port:** 4000
- **URL:** http://localhost:4000
- **CORS Origin:** http://localhost:3000

## Endpoints
| Procedure | Type  | Description                         |
|-----------|-------|-------------------------------------|
| `hello`   | query | Returns a greeting. Accepts optional `name` input. |

## Example Requests

### Default greeting
```
GET http://localhost:4000/hello?input={}
→ {"result":{"data":{"greeting":"Hello, world!"}}}
```

### Named greeting
```
GET http://localhost:4000/hello?input={"name":"Alice"}
→ {"result":{"data":{"greeting":"Hello, Alice!"}}}
```

## CORS Preflight Response
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type,trpc-batch-mode
```
