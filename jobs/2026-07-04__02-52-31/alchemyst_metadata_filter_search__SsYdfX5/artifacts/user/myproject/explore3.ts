import AlchemystAI from '@alchemystai/sdk';

const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY! });
const RUN = 'zri8cpsp3a';

async function main() {
  // (a) re-add existing fileName -> expect 409
  try {
    await client.v1.context.add({
      documents: [{ content: 'duplicate test' }],
      context_type: 'resource',
      source: 'docs',
      scope: 'internal',
      metadata: {
        fileName: `explore2-C-${RUN}.md`,
        groupName: ['support'],
        fileType: 'text/plain',
        fileSize: 10,
        lastModified: new Date().toISOString(),
      },
    } as any);
    console.log('RE-ADD: stored again (no 409!)');
  } catch (e: any) {
    console.log('RE-ADD: error', e?.status, JSON.stringify(e?.message || e?.error || '').slice(0, 200));
  }

  // (b) recall: nonsense query, groupName filter, broad thresholds
  await new Promise((r) => setTimeout(r, 2000));
  for (const g of ['support', 'engineering']) {
    try {
      const res = await client.v1.context.search({
        query: 'asdfqwerty nonsense zzz',
        similarity_threshold: 1.0,
        minimum_similarity_threshold: 0.0,
        scope: 'internal',
        metadata: 'true',
        body_metadata: { groupName: [g] },
      } as any);
      const ctxs = (res as any).contexts || [];
      const fns = Array.from(new Set(ctxs.map((c: any) => c.metadata?.file_name).filter(Boolean)));
      console.log(`\nRECALL [${g}] -> ${ctxs.length} ctx, ${fns.length} files:`, JSON.stringify(fns));
    } catch (e: any) {
      console.log(`RECALL [${g}] error`, e?.status, e?.message);
    }
  }
}

main().catch((e) => console.error('FATAL', e));