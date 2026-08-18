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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const onGet: RequestHandler = async (event) => {
  const q = event.query.get('q');
  const trimmed = q ? q.trim() : '';

  if (!q || trimmed.length < 2) {
    event.json(400, { error: "query must be at least 2 characters" });
    return;
  }

  if (trimmed.length > 50) {
    event.json(400, { error: "query must be at most 50 characters" });
    return;
  }

  const len = trimmed.length;
  const delay = Math.max(120, 1600 - (len - 2) * 500);
  await sleep(delay);

  if (trimmed.toLowerCase() === 'boom') {
    event.json(500, { error: "internal server error" });
    return;
  }

  const lowerTrimmed = trimmed.toLowerCase();
  const results = dataset
    .filter(item => item.name.toLowerCase().includes(lowerTrimmed))
    .sort((a, b) => a.id - b.id);

  event.json(200, {
    query: trimmed,
    count: results.length,
    results
  });
};
