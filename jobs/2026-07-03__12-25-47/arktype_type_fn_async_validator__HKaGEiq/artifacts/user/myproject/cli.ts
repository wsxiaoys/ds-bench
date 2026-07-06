import { fetchWithTimeout } from './src/validator.js';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    const parsed = JSON.parse(raw) as { params?: unknown };
    const params = parsed?.params;
    const result = await fetchWithTimeout(params as Parameters<typeof fetchWithTimeout>[0]);
    console.log('OK ' + JSON.stringify(result));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('ERR ' + (msg || 'validation failed'));
  }
}

main();
