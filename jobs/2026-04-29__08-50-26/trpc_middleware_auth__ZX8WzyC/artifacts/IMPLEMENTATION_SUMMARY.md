# tRPC v11 Authentication Middleware Implementation

## Overview
Successfully implemented authentication middleware for tRPC v11 standalone server with bearer token authentication.

## Implementation Details

### 1. Context Creation (`createContext`)
- Reads the `authorization` header from the incoming request
- Validates if the header matches exactly `Bearer mysecrettoken`
- If valid, returns context with user object: `{ id: 1, name: 'Admin' }`
- If invalid or missing, returns context with `user: null`

### 2. Authentication Middleware (`isAuthed`)
- Checks if `ctx.user` exists in the context
- If no user is present, throws a `TRPCError` with code `UNAUTHORIZED`
- Passes the user context to the next middleware/procedure

### 3. Protected Procedure (`protectedProcedure`)
- Created by chaining `t.procedure.use(isAuthed)`
- All procedures using this builder require authentication

### 4. Router (`appRouter`)
- Contains `secretData` query that uses `protectedProcedure`
- Returns `{ secret: "super secret" }` when authenticated
- Returns 401 UNAUTHORIZED when not authenticated

## Test Results

### Test 1: No Authorization Header
```bash
curl -s -X GET "http://localhost:3000/secretData"
```
**Result:** UNAUTHORIZED error (401)

### Test 2: Correct Authorization Header
```bash
curl -s -X GET "http://localhost:3000/secretData" -H "authorization: Bearer mysecrettoken"
```
**Result:** `{ "result": { "data": { "secret": "super secret" } } }`

### Test 3: Incorrect Authorization Header
```bash
curl -s -X GET "http://localhost:3000/secretData" -H "authorization: Bearer wrongtoken"
```
**Result:** UNAUTHORIZED error (401)

## Server Configuration
- Port: 3000
- Framework: tRPC v11 with standalone adapter
- Start command: `npm run start`

## Files Modified
- `/home/user/project/server.ts` - Main server implementation with authentication middleware

## Artifacts
- `/logs/artifacts/server.ts` - Copy of the complete implementation
- `/logs/artifacts/IMPLEMENTATION_SUMMARY.md` - This summary document