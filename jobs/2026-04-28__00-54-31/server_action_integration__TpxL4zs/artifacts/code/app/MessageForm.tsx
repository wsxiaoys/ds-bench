'use client';

import { useState } from 'react';
import { addMessageAction } from './actions';

export default function MessageForm() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await addMessageAction(text);
      setResult(res);
      setText('');
    } catch (error) {
      console.error(error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Message
          </label>
          <input
            type="text"
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter a message"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
          <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Result from Server Action:</h3>
          <p className="mt-2 text-sm text-green-700 dark:text-green-300">
            {JSON.stringify(result, null, 2)}
          </p>
        </div>
      )}
    </div>
  );
}
