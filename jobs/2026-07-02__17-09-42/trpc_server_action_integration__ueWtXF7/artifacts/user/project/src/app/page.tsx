import { AddMessageForm } from "./_components/AddMessageForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
          tRPC v11 + Next.js Server Actions
        </h1>
        <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Submit the form below. The Server Action calls the{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            addMessage
          </code>{" "}
          mutation via{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            createCallerFactory
          </code>{" "}
          and returns the result.
        </p>
      </div>

      <AddMessageForm />
    </div>
  );
}