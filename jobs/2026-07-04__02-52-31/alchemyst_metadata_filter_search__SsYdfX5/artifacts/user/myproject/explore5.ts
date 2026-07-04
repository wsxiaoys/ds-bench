import AlchemystAI from '@alchemystai/sdk';
const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY! });
const RUN = 'zri8cpsp3a';
async function main() {
  const res = await client.v1.context.view.docs();
  const docs = (res as any).documents || [];
  console.log('TOTAL docs:', docs.length);
  for (const d of docs) console.log(JSON.stringify({ fileName: d.fileName, groupName: d.groupName }));
  console.log('---contains explore:', docs.some((d:any)=>String(d.fileName).includes('explore')));
}
main().catch((e) => console.error('FATAL', e));