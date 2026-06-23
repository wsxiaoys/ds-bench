import MessageForm from "./MessageForm";

/**
 * Home page (Server Component)
 *
 * Renders the MessageForm client component which calls the tRPC
 * `addMessage` mutation through a Next.js Server Action.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-50 px-4 dark:bg-gray-950">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          tRPC v11 + Next.js Server Actions
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The form below calls a tRPC mutation via a Server Action —{" "}
          <span className="font-medium">no HTTP client needed</span>.
        </p>
      </div>

      <MessageForm />

      {/* Architecture summary */}
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        <p className="mb-2 font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
          Data flow
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>User submits the form (Client Component)</li>
          <li>
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
              addMessage()
            </code>{" "}
            Server Action is invoked
          </li>
          <li>
            Server Action creates a caller via{" "}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
              createCallerFactory
            </code>
          </li>
          <li>tRPC mutation executes on the server</li>
          <li>Result is serialised and returned to the client</li>
        </ol>
      </div>
    </main>
  );
}
