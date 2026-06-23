import { LlamaCloud } from '@llamaindex/llama-cloud';
const client = new LlamaCloud({ token: 'test' });
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client.files)));
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client.parsing)));
