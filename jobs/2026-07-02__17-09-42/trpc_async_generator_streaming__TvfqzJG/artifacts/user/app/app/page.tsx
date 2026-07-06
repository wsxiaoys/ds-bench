import { Chat } from "./_components/Chat";
import { TRPCProvider } from "./_components/TRPCProvider";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            tRPC v11 Streaming Chat
          </h1>
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Powered by native{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
              AsyncGenerator
            </code>{" "}
            responses over{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
              httpBatchStreamLink
            </code>
            .
          </p>
        </header>

        <TRPCProvider>
          <Chat />
        </TRPCProvider>
      </main>
    </div>
  );
}