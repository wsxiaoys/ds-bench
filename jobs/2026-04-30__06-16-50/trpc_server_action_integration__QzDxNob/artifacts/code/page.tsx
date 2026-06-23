import { MessageForm } from "@/app/MessageForm";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 py-32">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            tRPC + Next.js Server Actions
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Enter a message below. It will be sent via a Server Action that
            calls a tRPC mutation on the server.
          </p>
        </div>

        <MessageForm />
      </main>
    </div>
  );
}