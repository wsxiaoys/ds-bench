import type { RequestHandler } from '@builder.io/qwik-city';

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

export const onGet: RequestHandler = async (ev) => {
  const q = ev.query.get('q');
  const trimmed = q ? q.trim() : '';

  if (trimmed.length < 2) {
    ev.json(400, { error: "query must be at least 2 characters" });
    return;
  }

  if (trimmed.length > 50) {
    ev.json(400, { error: "query must be at most 50 characters" });
    return;
  }

  const len = trimmed.length;
  const delayMs = Math.max(120, 1600 - (len - 2) * 500);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (trimmed.toLowerCase() === 'boom') {
    ev.json(500, { error: "internal server error" });
    return;
  }

  const results = dataset.filter(item =>
    item.name.toLowerCase().includes(trimmed.toLowerCase())
  );

  ev.json(200, {
    query: trimmed,
    count: results.length,
    results
  });
};
