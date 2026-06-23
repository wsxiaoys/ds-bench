import { MessageForm } from "./message-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <h1 className="text-3xl font-bold">tRPC v11 + Next.js Server Actions</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Submit a message to call the tRPC <code>addMessage</code> mutation via a
        Server Action.
      </p>
      <MessageForm />
    </main>
  );
}
