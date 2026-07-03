// Probe script to determine the real Alchemyst API wire format.
const AlchemystAI = require('@alchemystai/sdk').default || require('@alchemystai/sdk');

const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });

const RUN = 'probe-' + Date.now();

async function main() {
  // ---- Probe 1: add with per-document snake_case metadata (docs shape) ----
  console.log('\n=== PROBE 1: per-document snake_case metadata ===');
  try {
    const r = await client.v1.context.add({
      context_type: 'resource',
      source: 'docs',
      scope: 'internal',
      documents: [{
        content: 'Probe doc 1: the refund policy offers 30 days. support team handles it.',
        metadata: { file_name: `probe1-${RUN}.md`, group_name: ['support'] },
      }],
    });
    console.log('ADD ok:', JSON.stringify(r));
  } catch (e) {
    console.log('ADD err:', e.status, e.message, JSON.stringify(e.error || e.body || {}).slice(0, 500));
  }

  // ---- Probe 2: add with top-level camelCase metadata (SDK types shape) ----
  console.log('\n=== PROBE 2: top-level camelCase metadata ===');
  try {
    const r = await client.v1.context.add({
      context_type: 'resource',
      source: 'docs',
      scope: 'internal',
      documents: [{
        content: 'Probe doc 2: the API endpoint requires authentication. engineering team owns it.',
      }],
      metadata: { fileName: `probe2-${RUN}.md`, groupName: ['engineering'] },
    });
    console.log('ADD ok:', JSON.stringify(r));
  } catch (e) {
    console.log('ADD err:', e.status, e.message, JSON.stringify(e.error || e.body || {}).slice(0, 500));
  }

  // wait for indexing
  console.log('\nwaiting 8s for indexing...');
  await new Promise(r => setTimeout(r, 8000));

  // ---- Probe 3: search with metadata=true to see what metadata comes back ----
  console.log('\n=== PROBE 3: search with metadata=true (include metadata) ===');
  try {
    const r = await client.v1.context.search({
      query: 'refund policy support',
      scope: 'internal',
      minimum_similarity_threshold: 0.0,
      similarity_threshold: 0.0,
      metadata: 'true',
    });
    console.log('SEARCH ok, contexts:', (r.contexts || []).length);
    for (const c of (r.contexts || []).slice(0, 5)) {
      console.log('  content:', String(c.content || '').slice(0, 60));
      console.log('  metadata:', JSON.stringify(c.metadata));
    }
  } catch (e) {
    console.log('SEARCH err:', e.status, e.message, JSON.stringify(e.error || e.body || {}).slice(0, 500));
  }

  // ---- Probe 4: search filter via body_metadata { groupName } ----
  console.log('\n=== PROBE 4: search filter body_metadata { groupName: [support] } ===');
  try {
    const r = await client.v1.context.search({
      query: 'refund policy support',
      scope: 'internal',
      minimum_similarity_threshold: 0.0,
      similarity_threshold: 0.0,
      metadata: 'true',
      body_metadata: { groupName: ['support'] },
    });
    console.log('SEARCH ok, contexts:', (r.contexts || []).length);
    for (const c of (r.contexts || []).slice(0, 5)) {
      console.log('  metadata:', JSON.stringify(c.metadata));
    }
  } catch (e) {
    console.log('SEARCH err:', e.status, e.message, JSON.stringify(e.error || e.body || {}).slice(0, 500));
  }

  // ---- Probe 5: search filter via body_metadata { group_name } snake ----
  console.log('\n=== PROBE 5: search filter body_metadata { group_name: [support] } ===');
  try {
    const r = await client.v1.context.search({
      query: 'refund policy support',
      scope: 'internal',
      minimum_similarity_threshold: 0.0,
      similarity_threshold: 0.0,
      metadata: 'true',
      body_metadata: { group_name: ['support'] },
    });
    console.log('SEARCH ok, contexts:', (r.contexts || []).length);
    for (const c of (r.contexts || []).slice(0, 5)) {
      console.log('  metadata:', JSON.stringify(c.metadata));
    }
  } catch (e) {
    console.log('SEARCH err:', e.status, e.message, JSON.stringify(e.error || e.body || {}).slice(0, 500));
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });