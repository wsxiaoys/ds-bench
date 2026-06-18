import { AlchemystAI } from '@alchemystai/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
  const res = await client.v1.context.search({
    query: "test document containing key ENG_V2_DOC",
    minimum_similarity_threshold: 0.1,
    similarity_threshold: 0.1,
    metadata: "true"
  } as any);
  
  const myDocs = res.contexts?.filter(c => (c.metadata as any)?.file_name?.includes('fresh-run-1'));
  console.error("ENG_V2_DOC:", myDocs?.map(c => c.metadata));
}
main().catch(console.error);
