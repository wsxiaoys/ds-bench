'use client';

import { useState } from 'react';
import { addMessageAction } from './actions';

export default function Home() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addMessageAction(message);
    setResult(res);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">tRPC v11 with Server Actions</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter a message"
          className="px-4 py-2 border border-gray-300 rounded text-black"
          required
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Send Message
        </button>
      </form>
      {result && (
        <div className="mt-8 p-4 border border-gray-300 rounded bg-gray-50 text-black w-full max-w-md">
          <p><strong>Success:</strong> {result.success ? 'Yes' : 'No'}</p>
          <p><strong>Message:</strong> {result.message}</p>
        </div>
      )}
    </main>
  );
}
