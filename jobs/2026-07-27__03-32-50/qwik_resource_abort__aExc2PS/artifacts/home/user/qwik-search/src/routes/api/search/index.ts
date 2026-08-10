import type { RequestHandler } from '@builder.io/qwik-city';

interface DatasetEntry {
  id: number;
  name: string;
}

const DATASET: DatasetEntry[] = [
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
  { id: 20, name: 'Dart' },
];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const onGet: RequestHandler = async (requestEvent) => {
  const raw = requestEvent.query.get('q') ?? '';
  const trimmed = raw.trim();
  const len = trimmed.length;

  if (len < 2) {
    throw requestEvent.json(400, { error: 'query must be at least 2 characters' });
  }

  if (len > 50) {
    throw requestEvent.json(400, { error: 'query must be at most 50 characters' });
  }

  const delayMs = Math.max(120, 1600 - (len - 2) * 500);
  await wait(delayMs);

  if (trimmed.toLowerCase() === 'boom') {
    throw requestEvent.json(500, { error: 'internal server error' });
  }

  const lowerQuery = trimmed.toLowerCase();
  const results = DATASET.filter((entry) => entry.name.toLowerCase().includes(lowerQuery)).sort(
    (a, b) => a.id - b.id
  );

  throw requestEvent.json(200, {
    query: trimmed,
    count: results.length,
    results,
  });
};
