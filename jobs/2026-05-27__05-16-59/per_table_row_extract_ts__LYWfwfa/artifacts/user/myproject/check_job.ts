import { LlamaCloud } from '@llamaindex/llama-cloud';
async function main() {
    const client = new LlamaCloud({ token: process.env.LLAMA_CLOUD_API_KEY });
    const job = await client.extract.get('ext-yvubeac0psr3brhqvxvxvedhf1ej');
    console.log(JSON.stringify(job, null, 2));
}
main().catch(console.error);
