'use client';
import { useEffect, useState } from 'react';
import { vanillaTrpc } from '@/trpc/client';

export default function ChatStream() {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const iterable = await vanillaTrpc.chatStream.query('Say hello');
      for await (const chunk of iterable as AsyncIterable<string>) {
        if (cancelled) return;
        setText((prev) => prev + chunk);
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p data-testid="chat-output">{text}</p>
      {done && <span data-testid="chat-done">done</span>}
    </div>
  );
}
