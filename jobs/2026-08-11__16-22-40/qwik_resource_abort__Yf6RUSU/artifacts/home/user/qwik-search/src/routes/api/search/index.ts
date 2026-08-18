import { type RequestHandler } from '@builder.io/qwik-city';

const DATASET = [
  { id: 1, name: 'Java' },
  { id: 2, name: 'JavaScript' },
  { id: 3, name: 'Jasmine' },
  { id: 4, name: 'Python' },
  { id: 5, name: 'Ruby' },
  { id: 6, name: 'Rust' },
  { id: 7, name: 'Go' },
  { id: 8, name: 'Kotlin' },
  { id: 9, name: 'Scala' },
  { id: 10, name: 'TypeScript' },
  { id: 11, name: 'C' },
  { id: 12, name: 'C++' },
  { id: 13, name: 'C#' },
  { id: 14, name: 'Haskell' },
  { id: 15, name: 'Elixir' },
  { id: 16, name: 'Erlang' },
  { id: 17, name: 'Perl' },
  { id: 18, name: 'PHP' },
  { id: 19, name: 'Swift' },
  { id: 20, name: 'Dart' }
];

export const onGet: RequestHandler = async (ev) => {
  const q = ev.query.get('q');
  const trimmed = q ? q.trim() : '';

  if (!q || trimmed.length < 2) {
    return ev.json(400, { error: 'query must be at least 2 characters' });
  }

  if (trimmed.length > 50) {
    return ev.json(400, { error: 'query must be at most 50 characters' });
  }

  const len = trimmed.length;
  const ms = Math.max(120, 1600 - (len - 2) * 500);

  // Apply artificial latency
  await new Promise((resolve) => setTimeout(resolve, ms));

  const lowerQ = trimmed.toLowerCase();
  if (lowerQ === 'boom') {
    return ev.json(500, { error: 'internal server error' });
  }

  const results = DATASET.filter((item) =>
    item.name.toLowerCase().includes(lowerQ)
  );

  // Ensure results are ordered by ascending id (they already are, but let's be explicit)
  results.sort((a, b) => a.id - b.id);

  return ev.json(200, {
    query: trimmed,
    count: results.length,
    results
  });
};
