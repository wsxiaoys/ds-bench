# tRPC Standalone Server with CORS

A standalone tRPC server configured with CORS support using tRPC v11.

## Setup

### Installation

```bash
npm install
```

### Dependencies

- `@trpc/server@next` - tRPC server library
- `zod` - Schema validation
- `cors` - CORS middleware
- `tsx` - TypeScript execution (dev dependency)

## Usage

### Start the server

```bash
npx tsx index.ts
```

The server will start on `http://localhost:4000`.

### API Endpoints

#### Hello Query

Returns a greeting with the current timestamp.

**Query:**
```bash
curl "http://localhost:4000/hello?input=%7B%22name%22%3A%22World%22%7D"
```

**Response:**
```json
{
  "result": {
    "data": {
      "greeting": "Hello, World!",
      "timestamp": "2026-04-29T00:55:03.817Z"
    }
  }
}
```

### CORS Configuration

The server is configured to accept requests from `http://localhost:3000` with credentials support.

**CORS Headers:**
- `Access-Control-Allow-Origin: http://localhost:3000`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE`

## Project Structure

```
.
├── index.ts          # Main server file
├── package.json      # Project dependencies
└── README.md         # This file
```

## Testing CORS

Test CORS with a pre-flight request:

```bash
curl -X OPTIONS http://localhost:4000/hello \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

Expected response should include CORS headers allowing requests from `http://localhost:3000`.