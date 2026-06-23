import { StreamNumbers } from "./components/stream-numbers";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-24 text-zinc-950">
      <div className="w-full max-w-xl rounded-2xl bg-white p-10 shadow-sm ring-1 ring-zinc-200">
        <h1 className="text-3xl font-semibold tracking-tight">tRPC v11 streaming</h1>
        <p className="mt-3 text-base text-zinc-600">
          The streamed output below is populated progressively from an AsyncGenerator-backed tRPC procedure.
        </p>
        <div className="mt-8 rounded-lg bg-zinc-100 p-4 font-mono text-lg">
          <StreamNumbers />
        </div>
      </div>
    </main>
  );
}
