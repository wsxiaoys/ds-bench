import * as fs from 'fs';
import AlchemystAI from '@alchemystai/sdk';

// Parse --group argument
function parseGroup(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--group');
  if (idx === -1 || idx + 1 >= args.length) {
    throw new Error('Missing required --group <group_name> argument');
  }
  const group = args[idx + 1];
  if (!group || typeof group !== 'string') {
    throw new Error('Invalid --group argument');
  }
  return group;
}

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    throw new Error('ALCHEMYST_AI_API_KEY environment variable not set');
  }

  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  const group = parseGroup();

  const client = new AlchemystAI({ apiKey });

  // Four resource documents. Each carries its file_name and group_name
  // under its metadata (snake_case keys), suffixed with run-id to keep them
  // unique across concurrent runs.
  const docs: Array<Record<string, unknown>> = [
    {
      content:
        'Support runbook one: This is the first customer support document ' +
        'describing how to triage billing disputes, verify invoices, and issue ' +
        'refunds or credits inside the support queue.',
      file_name: `support-1-${runId}.txt`,
      group_name: ['support'],
    },
    {
      content:
        'Support runbook two: This is the second customer support document ' +
        'covering account recovery, password resets, and how support agents ' +
        'should escalate issues that require engineering intervention.',
      file_name: `support-2-${runId}.txt`,
      group_name: ['support'],
    },
    {
      content:
        'Engineering design one: This is the first engineering document ' +
        'describing the production service architecture, including how ' +
        'requests flow through the API gateway and the workers that handle ' +
        'context ingestion.',
      file_name: `engineering-1-${runId}.txt`,
      group_name: ['engineering'],
    },
    {
      content:
        'Engineering design two: This is the second engineering document ' +
        'explaining how the semantic search index is built, how similarity ' +
        'scores are computed, and how group-based metadata filtering is ' +
        'applied at query time.',
      file_name: `engineering-2-${runId}.txt`,
      group_name: ['engineering'],
    },
  ];

  // Idempotent seeding. Adding the same file_name twice returns 409, so we
  // catch that error and continue without crashing on re-runs.
  for (const doc of docs) {
    try {
      const resp = await client.v1.context.add({
        documents: [doc as any],
        context_type: 'resource',
        source: 'docs',
        scope: 'internal',
      } as any);
      // eslint-disable-next-line no-console
      console.error(`[seed] added ${doc.file_name}: ${JSON.stringify(resp)}`);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      const msg = err?.message ?? String(err);
      if (status === 409 || /409|conflict|already/i.test(msg)) {
        // eslint-disable-next-line no-console
        console.error(`[seed] ${doc.file_name} already exists, skipping`);
        continue;
      }
      throw err;
    }
  }

  // Give the indexing pipeline a brief moment so newly added docs are
  // queryable on the very next request.
  await new Promise((r) => setTimeout(r, 3000));

  // Metadata-filtered search using camelCase groupName (the asymmetry!).
  // The SDK uses `body_metadata` for the request body field and `metadata`
  // as a query string parameter controlling whether metadata is returned.
  const searchResp: any = await client.v1.context.search({
    query: 'documents',
    scope: 'internal',
    similarity_threshold: 0.0,
    minimum_similarity_threshold: 0.0,
    metadata: 'true',
    body_metadata: { groupName: [group] },
  } as any);

  const contexts: any[] = Array.isArray(searchResp?.contexts)
    ? searchResp.contexts
    : [];

  const fileNames = new Set<string>();
  for (const c of contexts) {
    const candidates: unknown[] = [];
    const meta = c?.metadata;
    if (meta && typeof meta === 'object') {
      candidates.push((meta as any).file_name, (meta as any).fileName);
    } else if (typeof meta === 'string') {
      try {
        const parsed = JSON.parse(meta);
        candidates.push(parsed?.file_name, parsed?.fileName);
      } catch {
        /* ignore */
      }
    }
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        fileNames.add(candidate);
      }
    }
  }

  process.stdout.write(JSON.stringify([...fileNames]) + '\n');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack ?? err?.message ?? String(err));
  process.exit(1);
});
