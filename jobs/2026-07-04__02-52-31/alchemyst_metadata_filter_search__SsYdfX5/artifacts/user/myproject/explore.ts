import AlchemystAI from '@alchemystai/sdk';

const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY! });
const RUN = 'zri8cpsp3a';

async function main() {
  // Approach A: per-document snake_case metadata (task/quickstart style)
  const fileA = `explore-support-A-${RUN}.md`;
  try {
    await client.v1.context.add({
      documents: [
        {
          content:
            'Support doc A: Customers can request a refund within 30 days by emailing support@example.com.',
          metadata: {
            file_name: fileA,
            group_name: ['support'],
          },
        },
      ] as any,
      context_type: 'resource',
      source: 'docs',
      scope: 'internal',
    });
    console.log('A: stored (per-doc snake_case)');
  } catch (e: any) {
    console.log('A: error', e?.status, e?.message);
  }

  // Approach B: top-level camelCase metadata (OpenAPI/SDK-types style)
  const fileB = `explore-support-B-${RUN}.md`;
  try {
    await client.v1.context.add({
      documents: [
        {
          content:
            'Support doc B: To reset your password, click the forgot password link on the login page.',
        },
      ],
      context_type: 'resource',
      source: 'docs',
      scope: 'internal',
      metadata: {
        fileName: fileB,
        groupName: ['support'],
      } as any,
    });
    console.log('B: stored (top-level camelCase)');
  } catch (e: any) {
    console.log('B: error', e?.status, e?.message);
  }

  // wait for indexing
  await new Promise((r) => setTimeout(r, 8000));

  // Search filtered by groupName (camelCase), metadata=true to get metadata back
  for (const attempt of [
    { label: 'body_metadata groupName', params: { body_metadata: { groupName: ['support'] } } },
  ] as any) {
    try {
      const res = await client.v1.context.search({
        query: 'refund password reset support',
        similarity_threshold: 0.8,
        minimum_similarity_threshold: 0.3,
        scope: 'internal',
        metadata: 'true',
        ...attempt.params,
      } as any);
      const ctxs = (res as any).contexts || [];
      console.log(`\nSEARCH [${attempt.label}] -> ${ctxs.length} contexts`);
      for (const c of ctxs) {
        console.log(JSON.stringify({ content: String(c.content).slice(0, 60), metadata: c.metadata }));
      }
    } catch (e: any) {
      console.log(`SEARCH [${attempt.label}] error`, e?.status, e?.message);
    }
  }
}

main().catch((e) => console.error('FATAL', e));