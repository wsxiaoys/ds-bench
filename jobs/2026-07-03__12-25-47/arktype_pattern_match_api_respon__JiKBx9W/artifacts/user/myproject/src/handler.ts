import { match, scope } from 'arktype';

// Define a scope with the discriminated union types so the match keys can be
// resolved by the scope's parser.
const $ = scope({
  success: { status: '"success"', data: 'object' },
  error: { status: '"error"', code: 'number', reason: 'string' },
  pending: { status: '"pending"' },
});

// Read a single JSON object from stdin and write the formatted result to stdout.
const chunks: Buffer[] = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = $.match({
      success: (data: { data: unknown }) => `OK: ${JSON.stringify(data.data)}`,
      error: (e: { code: number; reason: string }) => `ERR ${e.code} ${e.reason}`,
      pending: () => `PENDING`,
      default: "assert"
    })(input);
    process.stdout.write(result + '\n');
  } catch (err) {
    process.exit(1);
  }
});
