import { MessageForm } from "@/app/message-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-16 text-slate-950">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
            Next.js Server Action + tRPC v11
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            Call a tRPC mutation securely on the server
          </h1>
          <p className="text-base leading-7 text-slate-600">
            This form submits to a Next.js Server Action, which uses
            createCallerFactory to invoke the addMessage mutation on the server.
          </p>
        </div>

        <MessageForm />
      </div>
    </main>
  );
}
