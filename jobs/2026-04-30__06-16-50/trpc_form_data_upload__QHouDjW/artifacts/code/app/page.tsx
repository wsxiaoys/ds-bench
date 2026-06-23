import { FileUpload } from "./_components/FileUpload";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black p-8">
      <main className="flex flex-col items-center gap-8 w-full max-w-3xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
            tRPC v11 File Upload
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Native FormData support — no experimental plugins needed
          </p>
        </div>

        <FileUpload />

        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center max-w-md">
          Files are saved to <code className="text-zinc-600 dark:text-zinc-400">public/uploads/</code> and
          validated with <code className="text-zinc-600 dark:text-zinc-400">zod-form-data</code> on the
          server.
        </p>
      </main>
    </div>
  );
}