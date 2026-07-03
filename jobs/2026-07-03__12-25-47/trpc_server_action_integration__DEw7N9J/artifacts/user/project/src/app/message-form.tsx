'use client';

import { useState } from 'react';
import { addMessageAction } from './actions';

type ActionResult = {
  success: boolean;
  message: string;
};

export function MessageForm() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(formData: FormData) {
    const submittedText = formData.get('text') as string;
    setText(submittedText);
    const res = await addMessageAction(submittedText);
    setResult(res);
  }

  return (
    <div className="w-full max-w-md">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <input
          name="text"
          type="text"
          placeholder="Enter a message"
          className="border border-zinc-300 dark:border-zinc-700 rounded px-4 py-2 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded px-5 py-2"
        >
          Submit
        </button>
      </form>
      {result && (
        <div className="mt-6 p-4 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-900">
          <p className="text-black dark:text-zinc-50">
            <strong>Result:</strong> {JSON.stringify(result)}
          </p>
        </div>
      )}
    </div>
  );
}
