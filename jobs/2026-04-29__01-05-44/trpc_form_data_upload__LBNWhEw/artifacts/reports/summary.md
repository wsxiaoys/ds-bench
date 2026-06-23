# tRPC v11 File Upload with Native FormData

## Implementation Details
- **Next.js 15**: Used the latest Next.js with App Router.
- **tRPC v11**: Configured tRPC with native `FormData` support.
- **zod-form-data**: Used for server-side validation of `FormData`.
- **TanStack Query v5**: Integrated as the underlying fetching library for tRPC.

## Key Files
- `src/lib/trpc/router.ts`: Contains the `uploadFile` mutation which handles the `FormData` and saves the file to `public/uploads`.
- `src/app/page.tsx`: Client-side component with a file input that sends `FormData` via tRPC mutation.
- `src/components/TrpcProvider.tsx`: tRPC and QueryClient provider setup.

## How it works
1. The client constructs a `FormData` object from a selected file.
2. The `uploadMutation.mutate(formData)` call sends the `FormData` directly to the tRPC endpoint.
3. tRPC v11 recognizes the `FormData` input and passes it to the resolver.
4. The resolver validates the input using `zod-form-data`, reads the file buffer, and writes it to the disk.
5. The resolver returns the URL of the uploaded file, which is then displayed on the client.
