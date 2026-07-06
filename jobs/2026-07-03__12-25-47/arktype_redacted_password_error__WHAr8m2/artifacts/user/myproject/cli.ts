import { validate } from './src/validator.ts';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();
  const trimmed = raw.trim();
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch (e) {
    console.log('INVALID: ' + JSON.stringify({ parseError: String(e) }));
    process.exit(0);
  }

  const result = validate(payload);
  if (result && typeof result === 'object' && 'byPath' in (result as object)) {
    console.log('INVALID: ' + JSON.stringify(result));
  } else {
    console.log('VALID');
    console.log(JSON.stringify(result));
  }
  process.exit(0);
}

main().catch((e) => {
  console.log('INVALID: ' + JSON.stringify({ error: String(e) }));
  process.exit(0);
});
