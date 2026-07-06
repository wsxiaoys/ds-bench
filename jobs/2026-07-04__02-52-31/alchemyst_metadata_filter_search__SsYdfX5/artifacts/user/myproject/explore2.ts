import AlchemystAI from '@alchemystai/sdk';

const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY! });
const RUN = 'zri8cpsp3a';

async function store(label: string, file: string, metadata: any) {
  try {
    await client.v1.context.add({
      documents: [{ content: `${label}: Refund policy - 30 day money back guarantee. Contact support@example.com. Password reset via forgot password link.` }],
      context_type: 'resource',
      source: 'docs',
      scope: 'internal',
      metadata,
    } as any);
    console.log(`${label}: stored`);
  } catch (e: any) {
    console.log(`${label}: error`, e?.status, e?.message);
  }
}

async function search(label: string, body_metadata: any) {
  try {
    const res = await client.v1.context.search({
      query: 'refund password reset support',
      similarity_threshold: 0.8,
      minimum_similarity_threshold: 0.2,
      scope: 'internal',
      metadata: 'true',
      body_metadata,
    } as any);
    const ctxs = (res as any).contexts || [];
    console.log(`\nSEARCH [${label}] -> ${ctxs.length} contexts`);
    for (const c of ctxs) {
      const m = c.metadata || {};
      console.log(JSON.stringify({ file_name: m.file_name, fileName: m.fileName, group_name: m.group_name, groupName: m.groupName }));
    }
  } catch (e: any) {
    console.log(`SEARCH [${label}] error`, e?.status, e?.message);
  }
}

async function main() {
  const now = new Date().toISOString();
  // C: camelCase store
  await store('C-camel', `explore2-C-${RUN}.md`, {
    fileName: `explore2-C-${RUN}.md`,
    groupName: ['support'],
    fileType: 'text/plain',
    fileSize: 200,
    lastModified: now,
  });
  // D: snake_case store (required fields still camelCase per schema)
  await store('D-snake', `explore2-D-${RUN}.md`, {
    file_name: `explore2-D-${RUN}.md`,
    group_name: ['support'],
    fileType: 'text/plain',
    fileSize: 200,
    lastModified: now,
  } as any);

  await new Promise((r) => setTimeout(r, 10000));

  // search filter camelCase groupName
  await search('groupName=support', { groupName: ['support'] });
  // search filter snake_case group_name (to see if it works too)
  await search('group_name=support', { group_name: ['support'] } as any);
}

main().catch((e) => console.error('FATAL', e));