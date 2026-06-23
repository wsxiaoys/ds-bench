# tRPC v11 File Upload with Native FormData

## Background
tRPC v11 introduces native support for `FormData`, making file uploads significantly simpler without needing experimental plugins or third-party parsers on the client side. In this task, you will implement a Next.js App Router application that features a file upload procedure using this new capability.

## Requirements
- Set up a Next.js 15 project with the App Router.
- Configure tRPC v11 and `@tanstack/react-query` v5.
- Create a tRPC router with an `uploadFile` mutation that accepts a `FormData` object containing a `file` field.
- Use `zod` and `zod-form-data` on the server to validate the input.
- The server should save the uploaded file to the `public/uploads` directory and return a URL to access it.
- Create a client-side React component with a file input form. When submitted, it should use the tRPC mutation to send the `FormData` directly.
- Display the uploaded image on the page after a successful upload.

## Implementation Guide
1. Initialize a Next.js project in `/home/user/project`.
2. Install required dependencies: `@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query@latest`, `zod`, `zod-form-data`.
3. Set up the tRPC server in `app/api/trpc/[trpc]/route.ts`.
4. Define the tRPC router with the `uploadFile` procedure using `zfd.formData({ file: zfd.file() })` for input validation.
5. In the mutation resolver, read the file buffer and write it to `public/uploads/`.
6. Set up the tRPC provider for the client.
7. Implement the main page `app/page.tsx` with a form that constructs a `FormData` object and passes it to the `uploadFile` mutation.

## Constraints
- Project path: `/home/user/project`
- Start command: `npm run build && npm start`
- Port: `3000`
- The upload directory must be `public/uploads`.

## Integrations
- None