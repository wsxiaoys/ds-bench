'use client';

import { useState } from 'react';
import { addMessageAction } from './actions';

export default function Home() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await addMessageAction(message);
      setResult(response);
      setMessage('');
    } catch (error) {
      console.error('Error submitting form:', error);
      setResult({
        success: false,
        message: 'An error occurred while submitting the message',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-8 dark:bg-black">
      <main className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            tRPC v11 + Server Actions
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Submit a message using tRPC mutations via Server Actions
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Message
            </label>
            <input
              type="text"
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              className="mt-2 block w-full rounded-md border-0 bg-white px-3 py-2 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-500 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your message..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Message'}
          </button>
        </form>

        {result && (
          <div
            className={`rounded-md p-4 ${
              result.success
                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            <p className="font-medium">
              {result.success ? '✓ Success!' : '✗ Error'}
            </p>
            <p className="mt-1 text-sm">{result.message}</p>
          </div>
        )}
      </main>
    </div>
  );
}