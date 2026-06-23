import MessageForm from './MessageForm';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 dark:bg-gray-900">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          tRPC v11 + Next.js Server Actions
        </h1>
        <div className="max-w-md mx-auto">
          <MessageForm />
        </div>
      </div>
    </main>
  );
}
