import { type RequestHandler } from '@builder.io/qwik-city';

const dataset = [
  { id: 1, name: "Java" },
  { id: 2, name: "JavaScript" },
  { id: 3, name: "Jasmine" },
  { id: 4, name: "Python" },
  { id: 5, name: "Ruby" },
  { id: 6, name: "Rust" },
  { id: 7, name: "Go" },
  { id: 8, name: "Kotlin" },
  { id: 9, name: "Scala" },
  { id: 10, name: "TypeScript" },
  { id: 11, name: "C" },
  { id: 12, name: "C++" },
  { id: 13, name: "C#" },
  { id: 14, name: "Haskell" },
  { id: 15, name: "Elixir" },
  { id: 16, name: "Erlang" },
  { id: 17, name: "Perl" },
  { id: 18, name: "PHP" },
  { id: 19, name: "Swift" },
  { id: 20, name: "Dart" }
];

export const onGet: RequestHandler = async ({ query, json }) => {
  const q = query.get('q');
  const trimmed = q ? q.trim() : '';

  if (!q || trimmed.length < 2) {
    return json(400, { error: "query must be at least 2 characters" });
  }

  if (trimmed.length > 50) {
    return json(400, { error: "query must be at most 50 characters" });
  }

  const len = trimmed.length;
  const latency = Math.max(120, 1600 - (len - 2) * 500);

  if (trimmed.toLowerCase() === 'boom') {
    await new Promise(resolve => setTimeout(resolve, latency));
    return json(500, { error: "internal server error" });
  }

  const results = dataset
    .filter(item => item.name.toLowerCase().includes(trimmed.toLowerCase()))
    .sort((a, b) => a.id - b.id);

  await new Promise(resolve => setTimeout(resolve, latency));

  return json(200, {
    query: trimmed,
    count: results.length,
    results
  });
};
