# tRPC v11 File Upload with Native FormData

A Next.js 15 application demonstrating tRPC v11's native FormData support for file uploads.

## Features

- ✅ Next.js 15 with App Router
- ✅ tRPC v11 with native FormData support
- ✅ @tanstack/react-query v5 for data fetching
- ✅ zod and zod-form-data for input validation
- ✅ File upload to `public/uploads` directory
- ✅ Display uploaded image on successful upload

## Project Structure

```
project/
├── app/
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts      # tRPC API route handler
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with TRPC provider
│   └── page.tsx                  # Upload form component
├── client/
│   ├── provider.tsx              # tRPC and QueryClient provider
│   └── trpc.ts                   # tRPC client configuration
├── public/
│   └── uploads/                  # File upload directory
├── server/
│   ├── router.ts                 # tRPC router with uploadFile mutation
│   └── trpc.ts                   # tRPC server configuration
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript configuration
```

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

### Production

```bash
npm run build
npm start
```

## How It Works

### Server Side

1. **tRPC Router** (`server/router.ts`):
   - Defines an `uploadFile` mutation
   - Uses `zod-form-data` to validate FormData input
   - Saves the uploaded file to `public/uploads/`
   - Returns the URL to access the uploaded file

2. **tRPC API Route** (`app/api/trpc/[trpc]/route.ts`):
   - Handles tRPC requests via Next.js API routes
   - Uses the `fetch` adapter from tRPC

### Client Side

1. **tRPC Client** (`client/trpc.ts`):
   - Creates a typed tRPC client

2. **TRPC Provider** (`client/provider.tsx`):
   - Wraps the app with tRPC and React Query providers
   - Configures the tRPC client to communicate with the API

3. **Upload Form** (`app/page.tsx`):
   - Provides a file input form
   - Creates a FormData object on submit
   - Calls the tRPC mutation directly with FormData
   - Displays the uploaded image after successful upload

## Key Technologies

- **Next.js 15**: React framework with App Router
- **tRPC v11**: End-to-end typesafe APIs
- **@tanstack/react-query v5**: Data fetching and caching
- **zod**: TypeScript-first schema validation
- **zod-form-data**: FormData validation with zod

## Notes

- tRPC v11 introduces native FormData support, eliminating the need for experimental plugins or third-party parsers on the client side
- The upload directory `public/uploads` is created automatically on first upload
- Uploaded files are accessible via `/uploads/[filename]`