import AlchemystAI from '@alchemystai/sdk';
const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY! });
const RUN = 'zri8cpsp3a';
async function main() {
  const res = await client.v1.context.view.docs();
  const docs = (res as any).documents || [];
  console.log('TOTAL docs:', docs.length);
  const mine = docs.filter((d: any) => String(d.fileName).includes(RUN));
  console.log('MINE (run-id):', JSON.stringify(mine.map((d: any) => ({ fileName: d.fileName, groupName: d.groupName })), null, 2));
}
main().catch((e) => console.error('FATAL', e));