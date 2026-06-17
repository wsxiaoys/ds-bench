'use client';
import { useState } from 'react';
import { trpc } from '../lib/trpc';

export default function Page() {
  const [text, setText] = useState('');
  const { data: todos, isLoading } = trpc.getTodos.useQuery();

  const utils = trpc.useUtils();

  const addTodo = trpc.addTodo.useMutation({
    onSuccess: () => {
      utils.getTodos.invalidate();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    addTodo.mutate({ text });
    setText('');
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Todo List</h1>
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border p-2 rounded text-black"
          placeholder="New Todo Item"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Add</button>
      </form>
      {isLoading ? <p>Loading...</p> : (
        <ul className="list-disc pl-5">
          {todos?.map(todo => (
            <li key={todo.id}>{todo.text}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
